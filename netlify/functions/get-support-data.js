// functions/get-support-data.js

// v2.2: 마감 임박순 정렬 기능 추가
const fetch = require('node-fetch');

// --- 캐시 기억 장치 ---
const cache = {
  allData: null,
  timestamp: 0,
};
const CACHE_DURATION = 10 * 60 * 1000; // 10분
// --------------------

exports.handler = async function(event, context) {
  try {
    const { page = '1', perPage = '12', searchTerm, region, category, favorites, sort } = event.queryStringParameters;
    
    const now = Date.now();
    if (cache.allData && (now - cache.timestamp < CACHE_DURATION)) {
      console.log(`[v2.2 백엔드] ⚡️ 캐시 히트!`);
      const filteredAndPaginatedData = processData(cache.allData, { page, perPage, searchTerm, region, category, favorites, sort });
      return { statusCode: 200, body: JSON.stringify(filteredAndPaginatedData) };
    }

    console.log(`[v2.2 백엔드] 🐢 캐시 미스! 정부 API에 새로 요청합니다.`);
    const API_KEY = process.env.GOV_API_KEY;
    if (!API_KEY) {
      throw new Error("API 키가 설정되지 않았습니다.");
    }

    const totalFetchCount = '500';
    const targetUrl = `http://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01?serviceKey=${encodeURIComponent(API_KEY)}&page=1&perPage=${totalFetchCount}&returnType=json`;
    
    const response = await fetch(targetUrl);
    const apiResult = await response.json();
    if (!apiResult || !apiResult.data) {
      throw new Error("정부 API로부터 유효한 데이터를 받지 못했습니다.");
    }
    
    const allData = apiResult.data;

    console.log(`[v2.2 백엔드] 💾 새로운 데이터를 캐시에 저장합니다.`);
    cache.allData = allData;
    cache.timestamp = now;

    const filteredAndPaginatedData = processData(allData, { page, perPage, searchTerm, region, category, favorites, sort });
    
    return { statusCode: 200, body: JSON.stringify(filteredAndPaginatedData) };

  } catch (error) {
    console.error('[v2.2 백엔드] 🔥 치명적 오류 발생:', error);
    return { statusCode: 500, body: JSON.stringify({ message: error.message }) };
  }
};

function processData(allData, { page, perPage, searchTerm, region, category, favorites, sort }) {
    console.log(`[v2.2 백엔드] ⚙️ 데이터 처리 시작...`, { sort });
    
    let filteredData = [...allData]; // 원본 배열 수정을 방지하기 위해 복사본 사용
    
    // 1. 필터링
    if (favorites) {
      const favoriteIds = favorites.split(',').map(id => parseInt(id, 10));
      filteredData = filteredData.filter(item => favoriteIds.includes(item.pbanc_sn));
    }
    if (searchTerm) {
      filteredData = filteredData.filter(item => 
        (item.biz_pbanc_nm || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.pbanc_ntrp_nm || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (region && region !== 'all') {
      filteredData = filteredData.filter(item => item.supt_regin === region);
    }
    if (category) {
      const categories = category.split(',');
      filteredData = filteredData.filter(item => categories.includes(item.supt_biz_clsfc));
    }
    
    // 2. 정렬
    if (sort === 'deadline') {
        filteredData.sort((a, b) => {
            const ddayA = calculateDdayDays(a.pbanc_rcpt_end_dt);
            const ddayB = calculateDdayDays(b.pbanc_rcpt_end_dt);

            if (ddayA < 0 && ddayB >= 0) return 1;
            if (ddayA >= 0 && ddayB < 0) return -1;
            
            return ddayA - ddayB;
        });
    }

    // 3. 페이지네이션
    const totalItems = filteredData.length;
    const pageNum = parseInt(page, 10);
    const perPageNum = parseInt(perPage, 10);
    const startIndex = (pageNum - 1) * perPageNum;
    const paginatedData = filteredData.slice(startIndex, startIndex + perPageNum);
    
    console.log(`[v2.2 백엔드] ✅ 데이터 처리 완료!`);

    return { data: paginatedData, totalItems: totalItems };
}

function calculateDdayDays(endDateStr) {
    if (!endDateStr || endDateStr.length !== 8) return 9999;
    const year = parseInt(endDateStr.substring(0, 4));
    const month = parseInt(endDateStr.substring(4, 6)) - 1;
    const day = parseInt(endDateStr.substring(6, 8));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(year, month, day);
    return Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
}