// netlify/functions/get-content.js v2.0 - JWT를 이용한 VIP 패스 검사 기능 추가

const admin = require('firebase-admin');
const jwt = require('jsonwebtoken'); // VIP 패스 검증을 위해 제작기를 불러옵니다.

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
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
      return { statusCode: 500, body: JSON.stringify({ message: '서버 설정 오류입니다.' }) };
  }

  let isVip = false; // 기본적으로는 VIP가 아니라고 가정합니다.

  // --- 1. 손님이 VIP 패스를 보여줬는지 확인 ---
  const authHeader = event.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1]; // 'Bearer ' 뒷부분의 토큰만 추출
    try {
      // --- 2. VIP 패스가 진짜인지 비밀 도장으로 검증 ---
      jwt.verify(token, JWT_SECRET);
      isVip = true; // 검증 성공! 이 손님은 VIP입니다.
      console.log('VIP user access granted.');
    } catch (error) {
      // 토큰이 위조되었거나, 만료되었을 경우
      console.log('Invalid or expired token:', error.message);
      isVip = false;
    }
  }

  try {
    const layoutRef = db.collection('layouts').doc('mainLayout');
    const layoutDoc = await layoutRef.get();
    
    if (!layoutDoc.exists) {
      throw new Error('mainLayout 문서를 찾을 수 없습니다.');
    }
    const contentIds = layoutDoc.data().contentIds || [];

    // --- 3. VIP 여부에 따라 다른 종류의 콘텐츠를 준비 ---
    let pagesQuery, adsQuery;

    if (isVip) {
      // VIP 손님에게는 모든 콘텐츠를 보여줍니다.
      pagesQuery = db.collection('pages').get();
      adsQuery = db.collection('ads').get();
    } else {
      // 일반 손님에게는 공개 콘텐츠('isMembersOnly'가 true가 아닌 것)만 보여줍니다.
      pagesQuery = db.collection('pages').where('isMembersOnly', '!=', true).get();
      adsQuery = db.collection('ads').where('isMembersOnly', '!=', true).get();
    }
    
    const [pagesSnapshot, adsSnapshot] = await Promise.all([pagesQuery, adsQuery]);

    const allContentMap = new Map();
    pagesSnapshot.forEach(doc => allContentMap.set(doc.id, { ...doc.data(), id: doc.id }));
    adsSnapshot.forEach(doc => allContentMap.set(doc.id, { ...doc.data(), id: doc.id }));
    
    const orderedContent = contentIds.map(id => allContentMap.get(id)).filter(Boolean);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderedContent),
    };

  } catch (error) {
    console.error('콘텐츠를 가져오는 중 오류 발생:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: '서버에서 콘텐츠를 가져오는 데 실패했습니다.' }),
    };
  }
};