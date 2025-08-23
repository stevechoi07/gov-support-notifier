// /netlify/functions/login.js

// Firebase Admin SDK를 사용하기 위해 불러옵니다.
const admin = require("firebase-admin");

// Netlify 환경 변수에서 서비스 계정 키를 가져옵니다.
// 이 키는 JSON 형태의 긴 텍스트이며, Netlify 사이트에서 설정해야 합니다.
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

// Firebase Admin 앱을 초기화합니다.
// 앱이 이미 초기화되었는지 확인하여 오류를 방지합니다.
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

exports.handler = async function(event) {
  // 1. POST 요청이 아니면 거절합니다.
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // 2. 요청 본문에서 비밀번호를 추출합니다.
    const { password } = JSON.parse(event.body);
    // 3. Netlify 환경 변수에서 진짜 비밀번호를 가져옵니다.
    const correctPassword = process.env.ADMIN_PASSWORD;

    // 4. 비밀번호가 일치하는지 확인합니다.
    if (password === correctPassword) {
      // 5. 비밀번호가 맞으면, 'admin-user'라는 고유 ID를 가진
      // 관리자를 위한 특별 출입증(Custom Token)을 생성합니다.
      const uid = "admin-user";
      const customToken = await admin.auth().createCustomToken(uid);

      // 6. 성공 신호와 함께 출입증을 admin.html로 보냅니다.
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, token: customToken }),
      };
    } else {
      // 7. 비밀번호가 틀리면, 실패 신호를 보냅니다.
      return {
        statusCode: 401,
        body: JSON.stringify({ success: false, message: "비밀번호가 틀렸습니다." }),
      };
    }
  } catch (error) {
    // 8. 예상치 못한 오류 발생 시, 서버 오류 신호를 보냅니다.
    console.error("Auth function error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: "서버 오류가 발생했습니다." }),
    };
  }
};