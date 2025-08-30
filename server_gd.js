const express = require('express');
const axios = require('axios');
const cors = require('cors'); // 우리 주방의 든든한 경비 아저씨!
const app = express();
const port = 3000;

// ================================================================
// V2.0.1 업데이트: 경비 정책을 더 똑똑하게!
// 'kfund.ai'에서 오는 손님은 VIP로 특별 대우해달라고 지시합니다.
const corsOptions = {
    origin: 'https://kfund.ai', // kfund.ai 에서 오는 요청만 허용!
    optionsSuccessStatus: 200 
};
app.use(cors(corsOptions)); // 새로운 경비 정책 적용!
// ================================================================


// --- 🚨 중요! 🚨 ---
// 아래 두 개의 API 키를 반드시 본인의 키로 교체해주세요!
const publicDataServiceKey = 'VbMUl6nKBiL6a6yzx91+8hse/g3kyc74ozF/alnNaqiAW+Tr5Y9cTFhyzar005dKIeaDThXBQlR37xPQmCXc9A=='; // 여기에 공공데이터 포털 인증키를 넣으세요
const kakaoRestApiKey = 'Bdae71c83941e7abbe59827c2625be7b'; // 여기에 카카오 REST API 키를 넣으세요
// --------------------


// 우리 레스토랑의 유일한 메뉴! '/api/shops'
app.get('/api/shops', async (req, res) => {
    const { lat: myLat, lng: myLng } = req.query;

    if (!myLat || !myLng) {
        return res.status(400).json({ message: "손님! 현재 위치(위도, 경도)를 알려주셔야 요리를 시작할 수 있어요!" });
    }

    console.log(`\n👨‍🍳 ${new Date().toLocaleTimeString()}: 강남점 홀에서 주문 접수! 손님 위치: ${myLat}, ${myLng}`);

    try {
        // ... (이하 로직은 이전과 동일) ...
        // 1단계: 신선한 재료(가게 목록) 사 오기
        console.log("🛒 1단계: 공공데이터 API에서 신선한 재료를 사 오는 중...");
        const publicApiUrl = `https://api.odcloud.kr/api/15083033/v1/uddi:73352516-e912-4229-8a5d-a0774a2a46e0?page=1&perPage=500&serviceKey=${publicDataServiceKey}`;
        const response = await axios.get(publicApiUrl);
        const rawShops = response.data.data;
        console.log(`✅ 1단계 성공: 재료 ${rawShops.length}개 확보 완료!`);

        // 2단계: 재료 손질 (주소 -> 좌표 변환)
        console.log("🔪 2단계: 재료를 손질해서 좌표를 얻는 중... (시간이 좀 걸려요!)");
        const geocodingPromises = rawShops.map(shop => {
            const address = shop['주소'];
            return axios.get('https://dapi.kakao.com/v2/local/search/address.json', {
                headers: { 'Authorization': `KakaoAK ${kakaoRestApiKey}` },
                params: { query: address }
            });
        });
        const geocodingResults = await Promise.all(geocodingPromises);

        const shopsWithCoords = rawShops.map((shop, index) => {
            const result = geocodingResults[index].data.documents[0];
            if (result) {
                return { ...shop, lat: parseFloat(result.y), lng: parseFloat(result.x) };
            }
            return null;
        }).filter(shop => shop !== null);
        console.log(`✅ 2단계 성공: 쓸만한 재료 ${shopsWithCoords.length}개 손질 완료!`);


        // 3단계: 최고의 레시피로 요리하기 (거리 계산 & 정렬)
        console.log("🔥 3단계: 손님 위치에 맞춰 최고의 레시피로 요리하는 중...");
        const getDistance = (lat1, lon1, lat2, lon2) => {
            const R = 6371;
            const dLat = (lat2 - lat1) * (Math.PI / 180);
            const dLon = (lon2 - lon1) * (Math.PI / 180);
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        };

        shopsWithCoords.forEach(shop => {
            shop.distance = getDistance(myLat, myLng, shop.lat, shop.lng);
        });

        shopsWithCoords.sort((a, b) => a.distance - b.distance);
        console.log(`✅ 3단계 성공: 맛있는 요리 완성!`);

        // 4단계: 홀로 요리 내보내기
        res.json(shopsWithCoords);
        console.log(`🚀 4단계: 완성된 요리를 홀로 전달 완료!`);

    } catch (error) {
        console.error("🔥 주방에서 대형 화재 발생!", error.response ? error.response.data : error.message);
        res.status(500).json({ message: "이런! 주방에서 불이 났어요! 잠시 후 다시 시도해주세요." });
    }
});


app.listen(port, () => {
    console.log(`\n🎉 GD Shop 레스토랑 서버가 http://localhost:${port} 에서 정상 영업을 시작했습니다!`);
    console.log("   강남점(kfund.ai) 홀 매니저의 주문을 기다리는 중...");
});