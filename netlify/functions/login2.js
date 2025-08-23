// /netlify/functions/login.js

// Firebase Admin SDK를 사용하기 위해 불러옵니다.
const admin = require("firebase-admin");

// Netlify 환경 변수에서 서비스 계정 키를 가져옵니다.
// 이 키는 JSON 형태의 긴 텍스트이며, Netlify 사이트에서 설정해야 합니다.
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

// Firebase Admin 앱을 초기화합니다.
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { password } = JSON.parse(event.body);
    const correctPassword = process.env.ADMIN_PASSWORD;

    if (password === correctPassword) {
      // 비밀번호가 맞으면, 'admin-user'라는 ID를 가진 사용자를 위한
      // 특별한 출입증(Custom Token)을 발급합니다.
      const uid = "admin-user";
      const customToken = await admin.auth().createCustomToken(uid);

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, token: customToken }),
      };
    } else {
      return {
        statusCode: 401,
        body: JSON.stringify({ success: false, message: "비밀번호가 틀렸습니다." }),
      };
    }
  } catch (error) {
    console.error("Auth function error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: "서버 오류가 발생했습니다." }),
    };
  }
};