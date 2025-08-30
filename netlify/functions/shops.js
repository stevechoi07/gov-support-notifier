// netlify/functions/shops.js

// v8.1: 새로운 shops-data.json의 데이터 구조(루트가 배열)에 맞게 데이터 참조 방식을 수정합니다.

const axios = require('axios');
// 새로운 데이터 구조는 루트가 바로 배열이므로, 이 변수에 가게 목록 배열이 직접 담깁니다.
const localShopData = require('./shops-data.json'); 

const kakaoRestApiKey = process.env.KAKAO_REST_API_KEY;

let shopCache = null;

async function prepareShopCache() {
    if (shopCache) return;
    console.log('🍳 주방 최초 오픈! 창고의 모든 재료를 손질하여 좌표를 붙이는 중...');

    try {
        // v8.1 변경점: .data 접근을 제거하고, localShopData(배열)를 직접 사용합니다.
        const originalShops = localShopData;

        if (!Array.isArray(originalShops)) {
            throw new Error('shops-data.json이 올바른 배열 형식이 아닙니다.');
        }

        const geocoder = axios.create({
            headers: { 'Authorization': `KakaoAK ${kakaoRestApiKey}` }
        });

        const geocodingPromises = originalShops.map(shop => {
            if (!shop['주소']) {
                console.warn(`[주소 없음] '${shop['업소명']}' 가게에 주소 데이터가 없습니다.`);
                return Promise.resolve(shop);
            }
            
            return geocoder.get('https://dapi.kakao.com/v2/local/search/address.json', { params: { query: shop['주소'] } })
                .then(res => {
                    if (res.data.documents.length > 0) {
                        shop.lat = parseFloat(res.data.documents[0].y);
                        shop.lng = parseFloat(res.data.documents[0].x);
                    } else {
                         console.warn(`[좌표 변환 실패] '${shop['주소']}' 주소를 찾을 수 없습니다.`);
                    }
                    return shop;
                }).catch(err => {
                    console.error(`[카카오 API 에러] '${shop['주소']}' 변환 중 에러:`, err.message);
                    return shop;
                });
        });

        const settledShops = await Promise.all(geocodingPromises);
        shopCache = settledShops.filter(shop => shop.lat && shop.lng);

        console.log(`✅ 재료 손질 완료! 총 ${originalShops.length}개 중 ${shopCache.length}개의 가게 좌표 변환 성공.`);
    } catch (error) {
        console.error('🔥 주방 오픈 중 심각한 문제 발생!', error.message);
        shopCache = [];
    }
}

exports.handler = async (event) => {
    if (shopCache === null) {
        await prepareShopCache();
    }
    
    // 이제 백엔드는 좌표 변환이 완료된 전체 가게 목록을 프론트엔드로 넘겨주기만 합니다.
    return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(shopCache || [])
    };
};