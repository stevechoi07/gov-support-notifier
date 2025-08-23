// /netlify/functions/login.js (DEBUGGING VERSION)

const admin = require("firebase-admin");

// Netlify 환경 변수에서 서비스 계정 키를 가져옵니다.
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

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
    console.log("--- 로그인 시도 시작 ---");

    // 1. admin.html에서 보낸 비밀번호를 확인합니다.
    const { password } = JSON.parse(event.body);
    console.log("입력된 비밀번호:", password ? "정상적으로 받음" : "받지 못함");

    // 2. Netlify '비밀 금고'에서 진짜 비밀번호를 꺼내봅니다.
    const correctPassword = process.env.ADMIN_PASSWORD;
    console.log("Netlify 금고의 비밀번호:", correctPassword ? `'${correctPassword}'` : "비어있음 (undefined)");

    // 3. 비밀번호를 비교합니다.
    if (password === correctPassword) {
      console.log("결과: 비밀번호 일치!");
      const uid = "admin-user";
      const customToken = await admin.auth().createCustomToken(uid);
      console.log("Firebase 출입증 발급 성공!");
      
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, token: customToken }),
      };
    } else {
      console.log("결과: 비밀번호 불일치!");
      return {
        statusCode: 401,
        body: JSON.stringify({ success: false, message: "비밀번호가 틀렸습니다." }),
      };
    }
  } catch (error) {
    console.error("!!! 로그인 함수에서 심각한 오류 발생:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: "서버 오류가 발생했습니다." }),
    };
  }
};