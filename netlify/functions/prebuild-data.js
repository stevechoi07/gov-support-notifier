// 이 파일은 Netlify 서버에서 실행되는 것이 아니라,
// 개발자인 당신의 컴퓨터에서 딱 한 번! 수동으로 실행하는 특별 스크립트입니다.
// 목적: 원본 CSV/JSON 데이터를 읽어서, 모든 가게의 주소를 카카오맵 API를 통해
// 위도/경도 좌표로 변환한 뒤, 'shops-data-with-coords.json'이라는
// 최종 결과물 파일을 생성합니다.

const fs = require('fs');
const axios = require('axios');

// 원본 데이터 파일 경로 (CSV 또는 JSON)
// CSV를 사용하려면 아래 주석을 해제하고, JSON을 사용하려면 현재 코드를 유지하세요.
// const SOURCE_FILE = './행정안전부_착한가격업소 현황_20250630.csv';
const SOURCE_FILE = './shops-data.json'; 

// 최종 결과물이 저장될 파일 경로
const OUTPUT_FILE = './shops-data-with-coords.json';

// ✨✨✨ 중요! ✨✨✨
// 아래에 당신의 카카오 REST API 키를 붙여넣으세요!
const KAKAO_REST_API_KEY = '';
// ✨✨✨✨✨✨✨✨✨

// API 호출 속도를 제어하기 위한 설정 (너무 빠르면 API가 차단할 수 있음)
const DELAY_MS = 50; // 50ms마다 한 번씩 호출

// CSV 데이터를 JSON 형태로 변환하는 함수
function parseCsv(csv) {
    const lines = csv.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
        // 큰따옴표 안의 쉼표를 무시하기 위한 정규식
        const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
        return headers.reduce((obj, header, i) => {
            let value = (values[i] || '').trim();
            // 큰따옴표 제거
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
            }
            obj[header] = value || null;
            return obj;
        }, {});
    });
}

// 주소를 위도/경도로 변환하는 함수
async function getCoords(address) {
    if (!address) return null;
    try {
        const response = await axios.get('https://dapi.kakao.com/v2/local/search/address.json', {
            params: { query: address },
            headers: { 'Authorization': `KakaoAK ${KAKAO_REST_API_KEY}` }
        });
        if (response.data.documents.length > 0) {
            const doc = response.data.documents[0];
            return { lat: parseFloat(doc.y), lng: parseFloat(doc.x) };
        }
        return null;
    } catch (error) {
        console.error(`[카카오 API 에러] 주소: "${address}" -`, error.response ? error.response.data : error.message);
        return null;
    }
}

// 메인 실행 함수
async function buildData() {
    console.log(`🚀 데이터 빌드를 시작합니다...`);
    console.log(`1. 원본 데이터 파일(${SOURCE_FILE})을 읽는 중...`);

    if (!fs.existsSync(SOURCE_FILE)) {
        console.error(`❌ 에러: 원본 데이터 파일(${SOURCE_FILE})을 찾을 수 없습니다!`);
        return;
    }
    
    const fileContent = fs.readFileSync(SOURCE_FILE, 'utf8');
    let shops;

    if (SOURCE_FILE.endsWith('.csv')) {
        shops = parseCsv(fileContent);
    } else {
        shops = JSON.parse(fileContent);
        // data 프로퍼티 안에 배열이 있는 구조인지 확인
        if (shops.data && Array.isArray(shops.data)) {
            shops = shops.data;
        }
    }
    
    console.log(`👍 총 ${shops.length}개의 가게 데이터를 발견했습니다.`);
    console.log(`2. 카카오맵 API를 사용해 좌표 변환을 시작합니다. (약 ${Math.round(shops.length * DELAY_MS / 1000)}초 예상)`);

    const shopsWithCoords = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < shops.length; i++) {
        const shop = shops[i];
        const coords = await getCoords(shop['주소']);
        
        // 진행 상황 표시 (10개마다)
        if ((i + 1) % 10 === 0 || i === shops.length - 1) {
            process.stdout.write(`... ${i + 1} / ${shops.length} 처리 중\r`);
        }

        if (coords) {
            shopsWithCoords.push({ ...shop, ...coords });
            successCount++;
        } else {
            failCount++;
        }

        // API 과호출 방지를 위한 딜레이
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }

    console.log('\n\n3. 좌표 변환 완료!');
    console.log(`   - ✅ 성공: ${successCount}개`);
    console.log(`   - ❌ 실패: ${failCount}개`);

    console.log(`4. 최종 결과물을 ${OUTPUT_FILE} 파일로 저장하는 중...`);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(shopsWithCoords, null, 4)); // null, 4는 예쁘게 들여쓰기

    console.log(`\n🎉 ${OUTPUT_FILE} 파일이 성공적으로 생성되었습니다!`);
    console.log(`   이제 이 파일을 프로젝트의 'functions' 폴더에 넣고 Netlify에 배포하세요!`);
}

buildData();

