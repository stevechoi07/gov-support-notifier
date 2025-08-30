// netlify/functions/shops.js

// 이 파일은 GD Shop의 '주방(백엔드)' 역할을 하는 서버리스 함수입니다.
// 손님(프론트엔드)의 요청에 맞춰 실시간으로 가게 데이터를 요리해서 제공합니다.

const axios = require('axios');

// --- 셰프님의 비밀 레시피 노트 ---
// Netlify 환경변수에서 API 키를 안전하게 불러옵니다.
const publicDataServiceKey = process.env.PUBLIC_DATA_API_KEY;
const kakaoRestApiKey = process.env.KAKAO_REST_API_KEY;

// --- 주방의 특급 냉장고 (캐시) ---
// 서버가 켜질 때 딱 한 번만 모든 재료를 손질해서 보관해 둡니다.
let shopCache = null;

// --- 새벽 시장 장보기 (서버 시작 시 1회 실행) ---
// 1. 공공데이터포털에서 가게 목록(주소만 있음)을 가져옵니다.
// 2. 카카오 API로 각 가게의 주소를 좌표로 변환합니다.
// 3. 모든 정보가 합쳐진 최종 데이터를 '특급 냉장고(shopCache)'에 저장합니다.
async function prepareShopCache() {
    if (shopCache) return; // 이미 재료가 준비되었다면 건너뜁니다.
    console.log('🍳 주방 오픈 준비! 새벽 시장에서 재료를 손질하는 중...');

    try {
        const publicApiUrl = `https://api.odcloud.kr/api/3045247/v1/uddi:6c32457a-bd61-4721-8dfd-c7b18991bf3e?page=1&perPage=300&serviceKey=${publicDataServiceKey}`;
        const response = await axios.get(publicApiUrl);
        const originalShops = response.data.data;

        const geocoder = axios.create({
            headers: { 'Authorization': `KakaoAK ${kakaoRestApiKey}` }
        });

        const geocodingPromises = originalShops.map(shop => {
            return geocoder.get('https://dapi.kakao.com/v2/local/search/address.json', { params: { query: shop['주소'] } })
                .then(res => {
                    if (res.data.documents.length > 0) {
                        shop.lat = parseFloat(res.data.documents[0].y);
                        shop.lng = parseFloat(res.data.documents[0].x);
                    }
                    return shop;
                }).catch(() => {
                    // 주소 변환에 실패해도 일단 가게 정보는 유지합니다.
                    return shop;
                });
        });

        const settledShops = await Promise.all(geocodingPromises);
        shopCache = settledShops.filter(shop => shop.lat && shop.lng); // 좌표가 있는 가게만 최종 저장

        console.log(`✅ 재료 준비 완료! ${shopCache.length}개의 가게를 특급 냉장고에 보관했습니다.`);
    } catch (error) {
        console.error('🔥 새벽 시장에서 문제 발생!', error.response ? error.response.data : error.message);
        shopCache = []; // 오류 발생 시 빈 냉장고로 설정
    }
}

// --- 손님 주문 처리 메인 로직 ---
exports.handler = async (event) => {
    // 서버가 처음 켜졌거나 재료가 없다면, 먼저 재료부터 준비합니다.
    if (!shopCache) {
        await prepareShopCache();
    }

    const { lat, lng, category, page = 1 } = event.queryStringParameters;
    const perPage = 12;

    // 1. (거리 계산) 손님 위치와 냉장고의 모든 재료 사이의 거리를 계산합니다.
    const shopsWithDistance = shopCache.map(shop => {
        const distance = getDistance(lat, lng, shop.lat, shop.lng);
        return { ...shop, distance };
    });

    // 2. (필터링) v6.1 업데이트: '깐깐한' 필터링에서 '똑똑한' 필터링으로 변경!
    let filteredShops = shopsWithDistance;
    if (category && category !== '전체') {
        if (category === '서비스') {
            const serviceKeywords = ['세탁', '미용', '이용', '목욕', '숙박', '서비스'];
            filteredShops = shopsWithDistance.filter(shop => {
                const shopCategory = shop['업종'] || '';
                return serviceKeywords.some(keyword => shopCategory.includes(keyword));
            });
        } else {
            // '한식', '중식' 등도 이제 포함 여부로 확인하여 더 유연하게 대응합니다.
            filteredShops = shopsWithDistance.filter(shop => {
                 const shopCategory = shop['업종'] || '';
                 return shopCategory.includes(category);
            });
        }
    }
    
    // 3. (정렬) 필터링된 결과를 가까운 순으로 정렬합니다.
    const sortedShops = filteredShops.sort((a, b) => a.distance - b.distance);
    
    // 4. (페이지네이션) 정렬된 결과에서 손님이 요청한 페이지의 12개만 잘라서 드립니다.
    const paginatedShops = sortedShops.slice((page - 1) * perPage, page * perPage);

    // 5. (서빙) 완성된 요리를 홀로 내보냅니다.
    return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paginatedShops)
    };
};

// --- 유틸리티 함수: 두 지점 간의 거리 계산 (하버사인 공식) ---
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // 지구 반지름 (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}