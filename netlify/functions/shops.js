// netlify/functions/shops.js

// v7.3: 외부 API 대신 로컬 JSON 파일(shops-data.json)을 사용해 안정성을 확보하는 비상 운영 모드로 전환합니다.

const axios = require('axios');
// v7.3 변경점: 우리 창고에 있는 비상식량(JSON 파일)을 불러옵니다.
const localShopData = require('./shops-data.json'); 

const kakaoRestApiKey = process.env.KAKAO_REST_API_KEY;

let shopCache = null;

const categoryMap = {
    '한식': ['한식'],
    '중식': ['중식', '중국'],
    '일식': ['일식', '회', '초밥'],
    '양식': ['양식', '돈까스', '패스트푸드'],
    '치킨/분식': ['치킨', '분식', '기타'],
    '서비스': ['세탁', '미용', '이용', '목욕', '숙박', '사진', 'PC방', '서비스', '기타 외식']
};

async function prepareShopCache() {
    if (shopCache) return;
    console.log('🍳 주방 오픈 준비! 창고에서 냉동 재료를 손질하는 중...');

    try {
        // v7.3 변경점: 외부 API를 호출하는 대신, 불러온 로컬 JSON 데이터에서 가게 목록을 바로 가져옵니다.
        const originalShops = localShopData.data;

        const geocoder = axios.create({
            headers: { 'Authorization': `KakaoAK ${kakaoRestApiKey}` }
        });

        // 주소 -> 좌표 변환은 카카오맵 API를 그대로 사용합니다.
        const geocodingPromises = originalShops.map(shop => {
            // v7.3 개선: 주소가 없는 가게는 좌표 변환을 시도하지 않도록 예외 처리
            if (!shop['주소']) return Promise.resolve(shop); 
            
            return geocoder.get('https://dapi.kakao.com/v2/local/search/address.json', { params: { query: shop['주소'] } })
                .then(res => {
                    if (res.data.documents.length > 0) {
                        shop.lat = parseFloat(res.data.documents[0].y);
                        shop.lng = parseFloat(res.data.documents[0].x);
                    }
                    return shop;
                }).catch(() => {
                    return shop; // 에러가 나도 원본 데이터는 유지
                });
        });

        const settledShops = await Promise.all(geocodingPromises);
        shopCache = settledShops.filter(shop => shop.lat && shop.lng);

        console.log(`✅ 재료 준비 완료! ${shopCache.length}개의 가게를 특급 냉장고에 보관했습니다.`);
    } catch (error) {
        console.error('🔥 창고 정리 중 문제 발생!', error.message);
        shopCache = [];
    }
}

// exports.handler 이하 코드는 이전과 동일합니다.
exports.handler = async (event) => {
    if (shopCache === null) {
        await prepareShopCache();
    }

    const { lat, lng, category, page = 1 } = event.queryStringParameters;
    const perPage = 12;

    const shopsWithDistance = shopCache.map(shop => {
        const distance = getDistance(lat, lng, shop.lat, shop.lng);
        return { ...shop, distance };
    });

    let filteredShops = shopsWithDistance;
    if (category && category !== '전체') {
        const keywords = categoryMap[category] || [category];
        filteredShops = shopsWithDistance.filter(shop => {
            const shopCategory = shop['업종'] || '';
            return keywords.some(keyword => shopCategory.includes(keyword));
        });
    }
    
    const sortedShops = filteredShops.sort((a, b) => a.distance - b.distance);
    
    const paginatedShops = sortedShops.slice((page - 1) * perPage, page * perPage);

    return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paginatedShops)
    };
};

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}