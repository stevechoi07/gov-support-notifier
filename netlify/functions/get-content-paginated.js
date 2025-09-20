// netlify/functions/get-content-paginated.js v1.0

const admin = require('firebase-admin');

// --- Firebase Admin SDK 초기화 ---
// 기존 get-content.js와 동일한 방식으로 초기화합니다.
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
    // --- 1. 기존 로직: 모든 콘텐츠 ID와 정보를 가져옵니다. ---
    const layoutRef = db.collection('layouts').doc('mainLayout');
    const layoutDoc = await layoutRef.get();
    
    if (!layoutDoc.exists) {
      throw new Error('mainLayout 문서를 찾을 수 없습니다.');
    }
    const contentIds = layoutDoc.data().contentIds || [];
    
    const pagesPromise = db.collection('pages').get();
    const adsPromise = db.collection('ads').get();
    
    const [pagesSnapshot, adsSnapshot] = await Promise.all([pagesPromise, adsPromise]);

    const allContentMap = new Map();
    pagesSnapshot.forEach(doc => allContentMap.set(doc.id, { ...doc.data(), id: doc.id }));
    adsSnapshot.forEach(doc => allContentMap.set(doc.id, { ...doc.data(), id: doc.id }));
    
    const orderedContent = contentIds.map(id => allContentMap.get(id)).filter(Boolean);

    // --- 2. [새로운 기능] 페이지네이션 로직을 적용합니다. ---
    const page = parseInt(event.queryStringParameters.page) || 1;
    const limit = parseInt(event.queryStringParameters.limit) || 5;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    
    const paginatedData = orderedContent.slice(startIndex, endIndex);

    // --- 3. 잘라낸 데이터와 전체 아이템 수를 함께 보냅니다. ---
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
          data: paginatedData,
          totalItems: orderedContent.length,
      }),
    };

  } catch (error) {
    console.error('콘텐츠를 가져오는 중 오류 발생:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: '서버에서 콘텐츠를 가져오는 데 실패했습니다.' }),
    };
  }
};