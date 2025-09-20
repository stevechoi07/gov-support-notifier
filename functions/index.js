// functions/index.js (v2.0 - 최신 v2 모듈식 문법 최종 수정본)

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

// Firebase Admin SDK 초기화 (이미 초기화되지 않은 경우에만)
if (!getApps().length) {
  initializeApp();
}

/**
 * 동영상이 Firebase Storage에 업로드되면 썸네일을 생성하는 함수 (v2 문법)
 */
exports.generateThumbnail = onObjectFinalized(
  {
    region: "asia-northeast3",
    timeoutSeconds: 300,
    memory: "1GiB", // v2에서는 GiB 단위를 사용합니다.
  },
  async (event) => {
    // 이벤트 데이터에서 파일 정보 추출
    const fileBucket = event.data.bucket;
    const filePath = event.data.name;
    const contentType = event.data.contentType;

    // 1. 함수가 스스로 생성한 썸네일이나, 동영상이 아닌 파일은 무시
    if (!contentType.startsWith("video/")) {
      logger.log("This is not a video.");
      return;
    }
    if (filePath.startsWith("thumbnails/")) {
      logger.log("This is already a thumbnail.");
      return;
    }

    logger.log(`New video detected: ${filePath}`);

    const bucket = getStorage().bucket(fileBucket);
    const fileName = path.basename(filePath);
    const tempFilePath = path.join(os.tmpdir(), fileName);
    const thumbnailFileName = `thumb_${path.parse(fileName).name}.jpg`;
    const tempThumbnailPath = path.join(os.tmpdir(), thumbnailFileName);
    const finalThumbnailPath = `thumbnails/${thumbnailFileName}`;

    try {
      // 2. 동영상 파일을 임시 폴더로 다운로드
      await bucket.file(filePath).download({ destination: tempFilePath });
      logger.log("Video downloaded locally to", tempFilePath);

      // 3. FFmpeg를 사용하여 동영상의 1초 지점에서 썸네일 추출
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

      // 4. Sharp를 사용하여 썸네일 리사이즈 및 최적화
      const resizedThumbnailBuffer = await sharp(tempThumbnailPath)
        .resize({ width: 640 })
        .jpeg({ quality: 80 })
        .toBuffer();
      logger.log("Thumbnail resized and optimized.");

      // 5. 최적화된 썸네일을 다시 Storage에 업로드
      const thumbnailFile = bucket.file(finalThumbnailPath);
      await thumbnailFile.save(resizedThumbnailBuffer, {
        metadata: { contentType: "image/jpeg" },
      });
      logger.log("Optimized thumbnail uploaded to", finalThumbnailPath);
      
      // 6. Firestore 문서에 썸네일 URL 업데이트
      const [thumbnailUrl] = await thumbnailFile.getSignedUrl({
          action: 'read',
          expires: '03-09-2491'
      });

      const db = getFirestore();
      const collectionsToSearch = ["ads", "adv"];
      for (const collectionName of collectionsToSearch) {
        const urlToQuery = `https://firebasestorage.googleapis.com/v0/b/${fileBucket}/o/${encodeURIComponent(filePath)}?alt=media`;
        const querySnapshot = await db.collection(collectionName).where("mediaUrl", "==", urlToQuery).get();
        
        if (!querySnapshot.empty) {
          const docId = querySnapshot.docs[0].id;
          await db.collection(collectionName).doc(docId).update({
            thumbnailUrl: thumbnailUrl,
          });
          logger.log(`Firestore document ${collectionName}/${docId} updated with thumbnail URL.`);
          break; 
        }
      }

    } catch (error) {
      logger.error("Error generating thumbnail:", error);
    } finally {
      // 7. 임시 폴더에 다운로드된 파일들을 삭제
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      if (fs.existsSync(tempThumbnailPath)) fs.unlinkSync(tempThumbnailPath);
    }
  }
);