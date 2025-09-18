// v1.7: 즐겨찾기 필터링 기능 추가
const fetch = require('node-fetch');

// --- 🧠 캐시 기억 장치 (v1.6에서 추가) ---
const cache = {
  allData: null,
  timestamp: 0,
};
const CACHE_DURATION = 10 * 60 * 1000; // 10분 (밀리초 단위)
// ------------------------------------

exports.handler = async function(event, context) {
  try {
    // [v1.7 수정] favorites 파라미터를 받을 수 있도록 추가
    const { page = '1', perPage = '12', searchTerm, region, category, favorites } = event.queryStringParameters;
    
    // 1. 캐시 확인
    const now = Date.now();
    if (cache.allData && (now - cache.timestamp < CACHE_DURATION)) {
      console.log(`[v1.7 백엔드] ⚡️ 캐시 히트! (Cache Hit) 저장된 데이터를 사용합니다.`);
      
      // [v1.7 수정] 캐시된 데이터를 처리할 때도 favorites 정보를 전달
      const filteredAndPaginatedData = processData(cache.allData, { page, perPage, searchTerm, region, category, favorites });
      
      return {
        statusCode: 200,
        body: JSON.stringify(filteredAndPaginatedData)
      };
    }

    // 2. 캐시가 없으면(Cache Miss) 정부 API에 요청
    console.log(`[v1.7 백엔드] 🐢 캐시 미스! (Cache Miss) 정부 API에 새로 요청합니다.`);
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

    // 3. 새로 받아온 데이터를 캐시에 저장
    console.log(`[v1.7 백엔드] 💾 새로운 데이터를 캐시에 저장합니다. (유효시간: 10분)`);
    cache.allData = allData;
    cache.timestamp = now;

    // 4. 새로 받아온 데이터를 사용해 처리
    // [v1.7 수정] 새로 받아온 데이터를 처리할 때도 favorites 정보를 전달
    const filteredAndPaginatedData = processData(allData, { page, perPage, searchTerm, region, category, favorites });
    
    return {
      statusCode: 200,
      body: JSON.stringify(filteredAndPaginatedData)
    };

  } catch (error) {
    console.error('[v1.7 백엔드] 🔥 치명적 오류 발생:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message })
    };
  }
};

/**
 * 데이터를 필터링하고 페이지에 맞게 잘라주는 헬퍼 함수
 * @param {Array} allData - 필터링할 전체 데이터 배열
 * @param {object} params - 필터 및 페이지 정보
 * @returns {object} - { data, totalItems }
 */
function processData(allData, { page, perPage, searchTerm, region, category, favorites }) {
    console.log(`[v1.7 백엔드] ⚙️ 데이터 처리 시작...`, { page, perPage, searchTerm, region, category, favorites });
    
    let filteredData = allData;
    
    // [v1.7 추가] 즐겨찾기 ID 목록이 있으면, 먼저 필터링
    if (favorites) {
      // 콤마로 구분된 문자열을 숫자 배열로 변환
      const favoriteIds = favorites.split(',').map(id => parseInt(id, 10));
      // 전체 데이터에서 즐겨찾기 ID에 해당하는 항목만 남김
      filteredData = filteredData.filter(item => favoriteIds.includes(item.pbanc_sn));
    }
    
    // 검색어(searchTerm) 필터링
    if (searchTerm) {
      filteredData = filteredData.filter(item => 
        (item.biz_pbanc_nm || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.pbanc_ntrp_nm || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    // 지역(region) 필터링
    if (region && region !== 'all') {
      filteredData = filteredData.filter(item => item.supt_regin === region);
    }
    // 사업분야(category) 필터링
    if (category) {
      const categories = category.split(',');
      filteredData = filteredData.filter(item => categories.includes(item.supt_biz_clsfc));
    }
    
    // 페이지네이션 처리
    const totalItems = filteredData.length;
    const pageNum = parseInt(page, 10);
    const perPageNum = parseInt(perPage, 10);
    const startIndex = (pageNum - 1) * perPageNum;
    const paginatedData = filteredData.slice(startIndex, startIndex + perPageNum);
    
    console.log(`[v1.7 백엔드] ✅ 데이터 처리 완료! (필터링된 총 개수: ${totalItems}개, 현재 페이지에 보낼 개수: ${paginatedData.length}개)`);

    return {
        data: paginatedData,
        totalItems: totalItems,
    };
}