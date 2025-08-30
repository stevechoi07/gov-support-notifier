// netlify/functions/shops.js

// v8.0: 백엔드 로직을 대폭 단순화합니다.
// 이제 백엔드의 역할은 로컬 JSON 데이터를 한 번에 처리해서 프론트엔드로 모두 넘겨주는 것입니다.
// 필터링, 페이지네이션 등 복잡한 로직은 모두 프론트엔드에서 처리합니다.

const axios = require('axios');
const localShopData = require('./shops-data.json'); 

const kakaoRestApiKey = process.env.KAKAO_REST_API_KEY;

// shopCache: 한 번 처리된 가게 데이터를 저장하여, 다음 요청 시에는 재처리 없이 즉시 응답하기 위한 변수입니다.
let shopCache = null;

// prepareShopCache: 서버가 처음 켜졌을 때 딱 한 번만 실행되는 함수입니다.
// 로컬 JSON 데이터의 모든 가게 주소를 카카오맵 API를 이용해 위도/경도 좌표로 변환합니다.
async function prepareShopCache() {
    if (shopCache) return;
    console.log('🍳 주방 최초 오픈! 창고의 모든 재료를 손질하여 좌표를 붙이는 중...');

    try {
        const originalShops = localShopData.data;

        const geocoder = axios.create({
            headers: { 'Authorization': `KakaoAK ${kakaoRestApiKey}` }
        });

        const geocodingPromises = originalShops.map(shop => {
            if (!shop['주소']) {
                console.warn(`[주소 누락] ${shop['업소명']} 가게의 주소 정보가 없습니다.`);
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

        // 모든 가게의 좌표 변환이 끝날 때까지 기다립니다.
        const settledShops = await Promise.all(geocodingPromises);
        
        // 좌표가 성공적으로 변환된 가게들만 shopCache에 저장합니다.
        shopCache = settledShops.filter(shop => shop.lat && shop.lng);

        console.log(`✅ 재료 손질 완료! 총 ${originalShops.length}개 중 ${shopCache.length}개의 가게 좌표 변환 성공.`);
    } catch (error) {
        console.error('🔥 주방 오픈 중 심각한 문제 발생!', error.message);
        shopCache = []; // 에러 시 빈 배열로 초기화
    }
}

// exports.handler: 프론트엔드의 요청을 처리하는 유일한 창구입니다.
exports.handler = async (event) => {
    // 서버가 처음 켜졌거나, shopCache가 비어있으면 데이터 손질(좌표 변환)을 시작합니다.
    if (shopCache === null) {
        await prepareShopCache();
    }

    // 손질이 완료된 전체 가게 목록을 프론트엔드로 전달합니다.
    return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(shopCache)
    };
};