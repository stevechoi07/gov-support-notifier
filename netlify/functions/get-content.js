// netlify/functions/get-content.js v1.0

const admin = require('firebase-admin');

// --- Firebase Admin SDK 초기화 ---
// subscribe.js에서 사용한 방식을 그대로 가져와서 일관성을 유지해요!
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
// 이 함수가 우리 경비원의 모든 행동을 정의합니다.
exports.handler = async (event, context) => {
  // 경비원은 손님이 'GET' 방식으로 요청할 때만 일해요.
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // --- 1. 레이아웃 순서 정보 가져오기 ---
    // 마치 요리사가 레시피(mainLayout)를 먼저 확인하는 것과 같아요.
    const layoutRef = db.collection('layouts').doc('mainLayout');
    const layoutDoc = await layoutRef.get();
    
    if (!layoutDoc.exists) {
      throw new Error('mainLayout 문서를 찾을 수 없습니다.');
    }
    const contentIds = layoutDoc.data().contentIds || [];

    // --- 2. 모든 콘텐츠(재료) 한 번에 가져오기 ---
    const pagesPromise = db.collection('pages').get();
    const adsPromise = db.collection('ads').get();
    
    // 두 가지 재료를 동시에 준비해서 시간을 절약해요!
    const [pagesSnapshot, adsSnapshot] = await Promise.all([pagesPromise, adsPromise]);

    // --- 3. 가져온 콘텐츠를 찾기 쉽게 정리하기 ---
    // 모든 재료에 이름표를 붙여서(id 기준) 바로 찾을 수 있게 준비해요.
    const allContentMap = new Map();
    pagesSnapshot.forEach(doc => allContentMap.set(doc.id, { ...doc.data(), id: doc.id }));
    adsSnapshot.forEach(doc => allContentMap.set(doc.id, { ...doc.data(), id: doc.id }));
    
    // --- 4. 레시피 순서대로 콘텐츠 최종 조립하기 ---
    // 이름표를 보고 레시피 순서대로 재료를 접시에 담습니다.
    const orderedContent = contentIds.map(id => allContentMap.get(id)).filter(Boolean);

    // --- 5. 완성된 요리(데이터)를 손님에게 전달! ---
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