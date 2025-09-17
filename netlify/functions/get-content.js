// netlify/functions/get-content.js v2.1 - 모든 사용자에게 모든 콘텐츠를 반환하도록 변경

const admin = require('firebase-admin');

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

  try {
    // --- VIP 여부와 관계없이 모든 데이터를 가져옵니다. ---
    const layoutRef = db.collection('layouts').doc('mainLayout');
    const layoutDoc = await layoutRef.get();
    
    if (!layoutDoc.exists) {
      throw new Error('mainLayout 문서를 찾을 수 없습니다.');
    }
    const contentIds = layoutDoc.data().contentIds || [];
    
    // 필터링 없이 모든 페이지와 카드를 가져옵니다.
    const pagesPromise = db.collection('pages').get();
    const adsPromise = db.collection('ads').get();
    
    const [pagesSnapshot, adsSnapshot] = await Promise.all([pagesPromise, adsPromise]);

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