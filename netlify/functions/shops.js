// 서버리스 환경에서는 axios와 같은 라이브러리만 필요합니다.
const axios = require('axios');

// ================================================================
// 🚨 V4.0 보안 강화: API 키는 이제 Netlify 환경변수를 사용합니다!
// Netlify 대시보드에서 직접 설정해야 합니다. 더 이상 코드에 키를 노출하지 마세요!
const publicDataServiceKey = process.env.PUBLIC_DATA_API_KEY;
const kakaoRestApiKey = process.env.KAKAO_REST_API_KEY;
// ================================================================

// v3.0의 '특급 재료 냉장고'(캐시) 개념을 그대로 가져옵니다.
let shopCache = [];

// 재료 준비 함수 (v3.0과 동일)
async function initializeCache() {
    console.log("🌞 Cold Start! 서버리스 주방 오픈 준비 중: 재료를 공수합니다...");
    try {
        const publicApiUrl = `https://api.odcloud.kr/api/3045247/v1/uddi:6c32457a-bd61-4721-8dfd-c7b18991bf3e`;
        const publicApiResponse = await axios.get(publicApiUrl, {
            params: { page: 1, perPage: 300, serviceKey: publicDataServiceKey },
        });
        
        let originalShops = publicApiResponse.data.data;
        console.log(`🛒 1단계: 재료 ${originalShops.length}개 확보 완료!`);

        console.log("🍳 2단계: 주소 좌표 변환 중 (최초 실행 시 시간이 걸립니다)...");
        const geocoder = axios.create({
            headers: { 'Authorization': `KakaoAK ${kakaoRestApiKey}` }
        });
        const geocodingPromises = originalShops.map(shop => 
            geocoder.get('https://dapi.kakao.com/v2/local/search/address.json', {
                params: { query: shop['주소'] }
            }).then(res => {
                if (res.data.documents.length > 0) {
                    shop.lat = parseFloat(res.data.documents[0].y);
                    shop.lng = parseFloat(res.data.documents[0].x);
                }
                return shop;
            }).catch(err => shop)
        );

        shopCache = (await Promise.all(geocodingPromises)).filter(shop => shop.lat && shop.lng);
        console.log(`✅ 오픈 준비 완료! 냉장고에 ${shopCache.length}개의 재료 보관 완료!`);
    } catch (error) {
        console.error("🔥 오픈 준비 중 화재 발생!", error.response ? error.response.data : error.message);
    }
}

// Netlify 서버리스 함수의 메인 핸들러
exports.handler = async (event, context) => {
    // ⭐️ 서버가 켜져있는게 아니라, 주문이 올 때마다 이 함수가 실행됩니다!
    
    // 만약 냉장고가 비어있다면(Cold Start), 딱 한번만 재료를 채웁니다.
    if (shopCache.length === 0) {
        await initializeCache();
    } else {
        console.log("👍 Warm Start! 이미 채워진 냉장고를 사용합니다.");
    }

    // 홀에서 보낸 주문 정보(query parameters)를 확인합니다.
    const { lat, lng, category, page = 1 } = event.queryStringParameters;
    
    // v3.0의 주문 처리 로직은 여기서부터 동일합니다.
    let filteredShops = shopCache;
    if (category && category !== '전체') {
        filteredShops = shopCache.filter(shop => shop['업종'].includes(category));
    }
    
    filteredShops.forEach(shop => {
        shop.distance = getDistance(lat, lng, shop.lat, shop.lng);
    });

    filteredShops.sort((a, b) => a.distance - b.distance);
    
    const perPage = 12;
    const startIndex = (page - 1) * perPage;
    const paginatedShops = filteredShops.slice(startIndex, startIndex + perPage);

    // 홀(프론트엔드)로 요리를 전달합니다. 이 형식을 반드시 지켜야 합니다.
    return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paginatedShops)
    };
};

// 거리 계산 함수 (v3.0과 동일)
function getDistance(lat1, lon1, lat2, lon2) {
    if ((lat1 == lat2) && (lon1 == lon2)) return 0;
    const radlat1 = Math.PI * lat1/180;
    const radlat2 = Math.PI * lat2/180;
    const theta = lon1-lon2;
    const radtheta = Math.PI * theta/180;
    let dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
    if (dist > 1) dist = 1;
    dist = Math.acos(dist);
    dist = dist * 180/Math.PI;
    dist = dist * 60 * 1.1515 * 1.609344;
    return dist;
}