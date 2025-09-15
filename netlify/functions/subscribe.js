// functions/subscribe.js

const admin = require('firebase-admin');

// Firebase Admin SDK 초기화
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { email } = JSON.parse(event.body);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { statusCode: 400, body: JSON.stringify({ success: false, message: '유효한 이메일을 입력해주세요.' }) };
    }

    const subscribersRef = db.collection('subscribers');
    // 이메일 중복 체크
    const snapshot = await subscribersRef.where('email', '==', email).get();
    if (!snapshot.empty) {
        return { statusCode: 409, body: JSON.stringify({ success: false, message: '이미 구독된 이메일입니다.' }) };
    }

    await subscribersRef.add({
      email: email,
      subscribedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { statusCode: 200, body: JSON.stringify({ success: true, message: '구독해주셔서 감사합니다!' }) };

  } catch (error) {
    console.error('Subscription error:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, message: '서버 오류가 발생했습니다.' }) };
  }
};