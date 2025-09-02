// 파일명: get-firebase-config.js
// 역할: Netlify 서버에서만 실행되어, 안전하게 보관된 Firebase 비밀키를 요청자에게 전달하는 비밀요원

exports.handler = async function(event, context) {
  // process.env는 Netlify 서버의 비밀 금고에서 환경 변수를 꺼내는 암호!
  // 브라우저에는 절대 노출되지 않아.
  const firebaseConfig = {
    apiKey: process.env.VITE_API_KEY,
    authDomain: process.env.VITE_AUTH_DOMAIN,
    projectId: process.env.VITE_PROJECT_ID,
    storageBucket: process.env.VITE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_APP_ID,
    measurementId: process.env.VITE_MEASUREMENT_ID
  };

  // 성공적으로 임무를 완수했다는 신호(statusCode: 200)와 함께
  // 비밀키(firebaseConfig)를 JSON 형태로 응답 본문(body)에 담아 전달한다.
  return {
    statusCode: 200,
    body: JSON.stringify(firebaseConfig),
  };
};