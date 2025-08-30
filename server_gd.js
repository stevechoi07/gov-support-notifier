// server_gd.js - GD Shop의 똑똑한 주방(백엔드)입니다. (이름 변경!)

// 1. 주방 도구들 챙기기 (모듈 임포트)
const express = require('express');
const axios = require('axios');
const cors = require('cors');

// 2. 주방(서버) 기본 설정
const app = express();
const PORT = 3000; // 3000번 포트에서 레스토랑을 엽니다.

app.use(cors()); // 다른 도메인(우리 프론트엔드)에서의 요청을 허용 (CORS 처리)
app.use(express.static(__dirname)); // 현재 폴더의 파일들을 제공할 수 있도록 설정

// 3. ★★★★★ 셰프의 비밀 재료 창고 열쇠 (API 키) ★★★★★
// 이 키들은 절대 손님(프론트엔드)에게 보여주면 안 됩니다!
const publicDataServiceKey = 'VbMUl6nKBiL6a6yzx91+8hse/g3kyc74ozF/alnNaqiAW+Tr5Y9cTFhyzar005dKIeaDThXBQlR37xPQmCXc9A=='; // <--- 여기에 공공데이터 API 키를 넣어주세요!
const kakaoRestApiKey = 'Bdae71c83941e7abbe59827c2625be7b';      // <--- 여기에 카카오 REST API 키를 넣어주세요!

// 4. 거리 계산 레시피 (v1.8에서 가져옴)
function getDistance(lat1, lon1, lat2, lon2) {
    if ((lat1 == lat2) && (lon1 == lon2)) return 0;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// 5. 메인 요리 주문받는 곳 (API 엔드포인트)
// 프론트엔드에서 /api/shops?lat=...&lng=... 형태로 주문이 들어옵니다.
app.get('/api/shops', async (req, res) => {
    try {
        const { lat: myLat, lng: myLng } = req.query;
        console.log(`주문 접수! 손님 위치: ${myLat}, ${myLng}`);

        // 1단계: 신선한 재료 공급받기 (공공데이터 API 호출)
        console.log('1단계: 공공데이터 API에서 재료 수급 중...');
        const apiEndpoint = `https://api.odcloud.kr/api/15083033/v1/uddi:705f4a18-436d-4b15-bcb3-c13f9f2575a7?page=1&perPage=100&serviceKey=${publicDataServiceKey}`;
        const response = await axios.get(apiEndpoint);
        let rawShops = response.data.data;
        console.log(`재료 ${rawShops.length}개 도착!`);
        
        // 2단계: 재료 손질하기 (주소 -> 좌표 변환)
        console.log('2단계: 재료 손질(주소 변환) 시작...');
        const geocodingPromises = rawShops.map(shop => 
            axios.get('https://dapi.kakao.com/v2/local/search/address.json', {
                params: { query: shop['주소'] },
                headers: { Authorization: `KakaoAK ${kakaoRestApiKey}` }
            }).then(res => {
                if (res.data.documents.length > 0) {
                    shop.lat = parseFloat(res.data.documents[0].y);
                    shop.lng = parseFloat(res.data.documents[0].x);
                    return shop;
                }
                return null;
            }).catch(err => {
                console.error(`'${shop['주소']}' 주소 변환 실패`, err.message);
                return null;
            })
        );
        const shopsWithCoords = (await Promise.all(geocodingPromises)).filter(shop => shop !== null);
        console.log(`손질 완료된 재료 ${shopsWithCoords.length}개.`);

        // 3단계: 주문에 맞춰 요리하기 (거리 계산 및 정렬)
        console.log('3단계: 메인 요리(거리 계산 및 정렬) 시작...');
        shopsWithCoords.forEach(shop => {
            shop.distance = getDistance(myLat, myLng, shop.lat, shop.lng);
        });
        shopsWithCoords.sort((a, b) => a.distance - b.distance);
        console.log('요리 완성!');

        // 4단계: 요리 서빙하기 (프론트엔드로 데이터 전송)
        res.json(shopsWithCoords);

    } catch (error) {
        console.error('주방에서 심각한 문제 발생!', error.message);
        res.status(500).json({ message: '서버에서 오류가 발생했습니다.' });
    }
});


// 6. 홀 서빙 담당
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/gdshop.html');
});


// 7. 레스토랑 개점!
app.listen(PORT, () => {
    console.log(`GD Shop 레스토랑 서버가 http://localhost:${PORT} 에서 정상 영업을 시작했습니다!`);
});