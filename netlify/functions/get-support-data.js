// functions/get-support-data.js

// v2.3: 외부 API 오류에 대한 안정성 강화
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
      console.log(`[v2.3 백엔드] ⚡️ 캐시 히트!`);
      const filteredAndPaginatedData = processData(cache.allData, { page, perPage, searchTerm, region, category, favorites, sort });
      return { statusCode: 200, body: JSON.stringify(filteredAndPaginatedData) };
    }

    console.log(`[v2.3 백엔드] 🐢 캐시 미스! 정부 API에 새로 요청합니다.`);
    
    let allData;

    try {
      const API_KEY = process.env.GOV_API_KEY;
      if (!API_KEY) {
        throw new Error("API 키가 설정되지 않았습니다.");
      }

      const totalFetchCount = '500';
      const targetUrl = `http://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01?serviceKey=${encodeURIComponent(API_KEY)}&page=1&perPage=${totalFetchCount}&returnType=json`;
      
      const response = await fetch(targetUrl);

      if (!response.ok) {
        throw new Error(`정부 API 서버 응답 오류! 상태: ${response.status}`);
      }
      
      const apiResult = await response.json();
      
      if (!apiResult || !apiResult.data) {
        console.warn("[v2.3 백엔드] ⚠️ 정부 API로부터 유효한 데이터 필드를 받지 못했습니다. 빈 배열로 처리합니다.");
        allData = [];
      } else {
        allData = apiResult.data;
      }

    } catch (fetchError) {
      console.error('[v2.3 백엔드] 🔥 정부 API 데이터 요청 중 심각한 오류 발생:', fetchError.message);
      throw new Error(`외부 API 서버와 통신하는 데 실패했습니다. (원인: ${fetchError.message})`);
    }

    console.log(`[v2.3 백엔드] 💾 새로운 데이터를 캐시에 저장합니다.`);
    cache.allData = allData;
    cache.timestamp = now;

    const filteredAndPaginatedData = processData(allData, { page, perPage, searchTerm, region, category, favorites, sort });
    
    return { statusCode: 200, body: JSON.stringify(filteredAndPaginatedData) };

  } catch (error) {
    console.error('[v2.3 백엔드] 🔥 최종 오류 처리:', error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ message: `서버 내부 오류: ${error.message}` }) 
    };
  }
};

function processData(allData, { page, perPage, searchTerm, region, category, favorites, sort }) {
    if (!Array.isArray(allData)) {
        console.warn("[v2.3 백엔드] ⚠️ processData로 전달된 데이터가 배열이 아니므로, 빈 배열로 처리합니다.");
        allData = [];
    }
    
    let filteredData = [...allData];
    
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
    
    console.log(`[v2.3 백엔드] ✅ 데이터 처리 완료! (필터링된 총 개수: ${totalItems}개)`);

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