// functions/subscribe.js v2.0 - JWT 토큰 발급 기능 추가

const admin = require('firebase-admin');
const jwt = require('jsonwebtoken'); // 1. VIP 패스 제작기를 불러옵니다.

// --- Firebase Admin SDK 초기화 ---
try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }
} catch (e) {
    console.error('Firebase Admin SDK 초기화 실패:', e);
}
const db = admin.firestore();

// --- 메인 핸들러 함수 ---
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // 2. 우리의 비밀 도장을 환경 변수에서 가져옵니다.
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    console.error('JWT_SECRET이 설정되지 않았습니다.');
    return { statusCode: 500, body: JSON.stringify({ success: false, message: '서버 설정 오류입니다.' }) };
  }

  try {
    const { email } = JSON.parse(event.body);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { statusCode: 400, body: JSON.stringify({ success: false, message: '유효한 이메일을 입력해주세요.' }) };
    }

    const subscribersRef = db.collection('subscribers');
    const snapshot = await subscribersRef.where('email', '==', email).get();

    let message = '';

    // 3. 기존 구독자인지 확인하고, 아니라면 새로 등록합니다.
    if (snapshot.empty) {
        // 신규 구독자일 경우
        await subscribersRef.add({
            email: email,
            subscribedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        message = '구독이 완료되었습니다! 환영합니다!';
    } else {
        // 기존 구독자일 경우 (로그인으로 처리)
        message = '다시 찾아주셔서 감사합니다! 로그인되었습니다.';
    }

    // 4. 신규/기존 모든 사용자에게 VIP 패스(JWT)를 발급합니다.
    const token = jwt.sign(
        { email: email }, // 패스에 담을 정보
        JWT_SECRET,        // 비밀 도장으로 서명
        { expiresIn: '30d' } // 유효기간 30일
    );

    // 5. 성공 메시지와 함께 VIP 패스를 전달합니다.
    return {
        statusCode: 200,
        body: JSON.stringify({
            success: true,
            message: message,
            token: token // 바로 이 부분이 새로 추가된 VIP 패스입니다!
        })
    };

  } catch (error) {
    console.error('Subscription/Login error:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, message: '서버 오류가 발생했습니다.' }) };
  }
};