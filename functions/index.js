// functions/index.js (v2.8 - 파일 이름 기반 최종 수정본)

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

    const fileName = path.basename(filePath);
    
    // 파일 이름에서 정보를 분리합니다. (예: "ads---docId---timestamp.mp4")
    const parts = path.parse(fileName).name.split('---');
    if (parts.length < 2) {
        logger.warn(`Filename "${fileName}" does not match the expected format. Exiting.`);
        return;
    }
    const collectionName = parts[0];
    const docId = parts[1];

    logger.log(`Processing video: ${filePath} for document: ${collectionName}/${docId}`);

    const bucket = getStorage().bucket(fileBucket);
    const tempFilePath = path.join(os.tmpdir(), fileName);
    const thumbnailFileName = `thumb_${path.parse(fileName).name}.jpg`;
    const tempThumbnailPath = path.join(os.tmpdir(), thumbnailFileName);
    const finalThumbnailPath = `thumbnails/${thumbnailFileName}`;

    try {
      await bucket.file(filePath).download({ destination: tempFilePath });
      logger.log("Video downloaded locally to", tempFilePath);

      await new Promise((resolve, reject) => {
        ffmpeg(tempFilePath)
          .on("end", resolve)
          .on("error", reject)
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
      
      await thumbnailFile.makePublic();
      const thumbnailUrl = `https://storage.googleapis.com/${fileBucket}/${finalThumbnailPath}`;
      logger.log("Thumbnail made public. URL:", thumbnailUrl);

      const db = getFirestore();
      const docRef = db.collection(collectionName).doc(docId);
      
      if (collectionName === "pages") {
          const docSnapshot = await docRef.get();
          if (docSnapshot.exists) {
              const pageSettings = docSnapshot.data().pageSettings || {};
              const newPageSettings = { ...pageSettings, thumbnailUrl: thumbnailUrl };
              await docRef.update({ pageSettings: newPageSettings });
          }
      } else {
          await docRef.update({ thumbnailUrl: thumbnailUrl });
      }
      logger.log(`Firestore document ${collectionName}/${docId} updated successfully.`);

    } catch (error) {
      logger.error("Error generating thumbnail:", error);
    } finally {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      if (fs.existsSync(tempThumbnailPath)) fs.unlinkSync(tempThumbnailPath);
    }
  }
);