// functions/index.js (v2.3 - 문법 오류 수정 최종본)

const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { logger } = require("firebase-functions");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const path = require("path");
const os = require("os");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const sharp = require("sharp");

if (!getApps().length) {
  initializeApp();
}

exports.generateThumbnail = onObjectFinalized(
  {
    region: "asia-northeast3",
    timeoutSeconds: 300,
    memory: "1GiB",
  },
  async (event) => {
    const fileBucket = event.data.bucket;
    const filePath = event.data.name;
    const contentType = event.data.contentType;

    if (!contentType.startsWith("video/")) {
      logger.log("This is not a video.");
      return;
    }
    if (filePath.startsWith("thumbnails/")) {
      logger.log("This is already a thumbnail.");
      return;
    }

    logger.log(`Processing video: ${filePath}`);

    const bucket = getStorage().bucket(fileBucket);
    const fileName = path.basename(filePath);
    const tempFilePath = path.join(os.tmpdir(), fileName);
    const thumbnailFileName = `thumb_${path.parse(fileName).name}.jpg`;
    const tempThumbnailPath = path.join(os.tmpdir(), thumbnailFileName);
    const finalThumbnailPath = `thumbnails/${thumbnailFileName}`;
    
    const timestampMatch = fileName.match(/_(\d{13})_/);
    if (!timestampMatch) {
        logger.log(`Filename ${fileName} does not contain a timestamp. Exiting.`);
        return;
    }
    const timestamp = timestampMatch[1];
    logger.log(`Extracted timestamp ${timestamp} from filename.`);

    try {
      await bucket.file(filePath).download({ destination: tempFilePath });
      logger.log("Video downloaded locally to", tempFilePath);

      await new Promise((resolve, reject) => {
        ffmpeg(tempFilePath)
          .on("end", resolve)
          .on("error", reject) // ✨ [수정] 빠졌던 .on()을 추가했습니다.
          .screenshots({
            timestamps: ["1"],
            filename: thumbnailFileName,
            folder: os.tmpdir(),
          });
      });
      logger.log("Thumbnail generated at", tempThumbnailPath);

      const resizedThumbnailBuffer = await sharp(tempThumbnailPath)
        .resize({ width: 640 })
        .jpeg({ quality: 80 })
        .toBuffer();
      logger.log("Thumbnail resized and optimized.");

      const thumbnailFile = bucket.file(finalThumbnailPath);
      await thumbnailFile.save(resizedThumbnailBuffer, {
        metadata: { contentType: "image/jpeg" },
      });
      logger.log("Optimized thumbnail uploaded to", finalThumbnailPath);
      
      const [thumbnailUrl] = await thumbnailFile.getSignedUrl({
          action: 'read',
          expires: '03-09-2491'
      });

      const db = getFirestore();
      const collectionsToSearch = ["ads", "adv"];
      let documentFound = false;
      for (const collectionName of collectionsToSearch) {
        const q = db.collection(collectionName);
        const querySnapshot = await q.get();

        for (const doc of querySnapshot.docs) {
            const data = doc.data();
            const mediaUrl = data.mediaUrl;
            if (mediaUrl && mediaUrl.includes(timestamp)) {
                await doc.ref.update({ thumbnailUrl: thumbnailUrl });
                logger.log(`Firestore document ${collectionName}/${doc.id} updated with thumbnail URL.`);
                documentFound = true;
                break; 
            }
        }
        if(documentFound) break;
      }
      if(!documentFound) {
        logger.warn(`No Firestore document found in any collection containing timestamp ${timestamp}`);
      }

    } catch (error) {
      logger.error("Error generating thumbnail:", error);
    } finally {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      if (fs.existsSync(tempThumbnailPath)) fs.unlinkSync(tempThumbnailPath);
    }
  }
);