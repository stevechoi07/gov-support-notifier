// netlify/functions/shops.js

// v7.0: 전국 단위의 최종 CSV 데이터를 분석하여 카테고리 맵을 완성하고, 필터링 시스템을 최종 진화시킵니다.

const axios = require('axios');

const publicDataServiceKey = process.env.PUBLIC_DATA_API_KEY;
const kakaoRestApiKey = process.env.KAKAO_REST_API_KEY;

let shopCache = null;

// v7.0 업데이트: 전국 단위 데이터를 분석하여 만든 최종 '스마트 레시피 북'
const categoryMap = {
    '한식': ['한식'],
    '중식': ['중식', '중국'],
    '일식': ['일식', '회', '초밥'],
    '양식': ['양식', '돈까스', '패스트푸드'],
    '치킨/분식': ['치킨', '분식', '기타'], // 사용자들이 자주 찾는 치킨과 분식을 묶음
    '서비스': ['세탁', '미용', '이용', '목욕', '숙박', '사진', 'PC방', '서비스', '기타 외식'] // 기타 외식도 서비스로 분류
};

async function prepareShopCache() {
    if (shopCache) return;
    console.log('🍳 주방 오픈 준비! 전국 시장에서 재료를 손질하는 중...');

    try {
        // 더 많은 데이터를 가져오기 위해 perPage를 500으로 상향
        const publicApiUrl = `https://api.odcloud.kr/api/3045247/v1/uddi:6c32457a-bd61-4721-8dfd-c7b18991bf3e?page=1&perPage=500&serviceKey=${publicDataServiceKey}`;
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
        console.error('🔥 새벽 시장에서 문제 발생!', error.response ? error.response.data : error.message);
        shopCache = [];
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

