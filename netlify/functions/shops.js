// netlify/functions/shops.js

// v7.2: 재료 수급(API 호출) 단계의 문제를 파악하기 위해 상세한 에러 로그(CCTV)를 설치합니다.

const axios = require('axios');

const publicDataServiceKey = process.env.PUBLIC_DATA_API_KEY;
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
    console.log('🍳 주방 오픈 준비! 전국 시장에서 재료를 손질하는 중...');

    try {
        // v7.1 업데이트: 과도한 요청을 막기 위해 perPage를 500에서 300으로 다시 조정합니다.
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
                    return shop;
                });
        });

        const settledShops = await Promise.all(geocodingPromises);
        shopCache = settledShops.filter(shop => shop.lat && shop.lng);

        console.log(`✅ 재료 준비 완료! ${shopCache.length}개의 가게를 특급 냉장고에 보관했습니다.`);
    } catch (error) {
        // v7.2 업데이트: 상세 에러 로깅 (CCTV)
        console.error('🔥 새벽 시장에서 문제 발생! 배달 트럭이 전복된 듯!');
        if (error.response) {
            // API 서버가 응답했지만, 상태 코드가 2xx가 아닐 경우
            console.error('응답 데이터:', error.response.data);
            console.error('응답 상태 코드:', error.response.status);
            console.error('응답 헤더:', error.response.headers);
        } else if (error.request) {
            // 요청은 했지만, 응답을 받지 못했을 경우
            console.error('요청 정보:', error.request);
        } else {
            // 요청을 설정하는 중에 에러가 발생했을 경우
            console.error('에러 메시지:', error.message);
        }
        shopCache = []; // 에러 발생 시 캐시를 빈 배열로 초기화
    }
}

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