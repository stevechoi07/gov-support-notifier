// v1.3: 페이지네이션 및 서버사이드 필터링 기능 추가
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  try {
    // 1. 프론트엔드가 요청한 필터 조건과 페이지 정보 확인
    const { page = '1', perPage = '12', searchTerm, region, category } = event.queryStringParameters;
    console.log(`[v1.3 백엔드] 🚀 함수 실행! 전달받은 조건:`, { page, perPage, searchTerm, region, category });

    const API_KEY = process.env.GOV_API_KEY;
    if (!API_KEY) {
      throw new Error("API 키가 설정되지 않았습니다.");
    }

    // 2. 정부 API에서는 필터링을 위해 일단 전체 데이터를 요청 (최대 500개)
    const totalFetchCount = '500';
    const targetUrl = `http://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01?serviceKey=${encodeURIComponent(API_KEY)}&page=1&perPage=${totalFetchCount}&returnType=json`;
    
    console.log(`[v1.3 백엔드] 📡 정부 API에 데이터 요청... (최대 ${totalFetchCount}개)`);
    const response = await fetch(targetUrl);
    const apiResult = await response.json();

    if (!apiResult || !apiResult.data) {
        throw new Error("정부 API로부터 유효한 데이터를 받지 못했습니다.");
    }
    
    let allData = apiResult.data;
    console.log(`[v1.3 백엔드] ✅ 정부 API로부터 원본 데이터 수신 완료! (총 ${allData.length}개)`);
    
    // 3. 전달받은 조건으로 서버에서 직접 필터링 수행
    let filteredData = allData;
    
    // 3-1. 검색어(searchTerm) 필터링
    if (searchTerm) {
      filteredData = filteredData.filter(item => 
        (item.biz_pbanc_nm || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.pbanc_ntrp_nm || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    // 3-2. 지역(region) 필터링
    if (region && region !== 'all') {
      filteredData = filteredData.filter(item => item.supt_regin === region);
    }
    // 3-3. 사업분야(category) 필터링 (다중 선택 가능, 콤마로 구분된 문자열 ex: "융자지원,멘토링")
    if (category) {
      const categories = category.split(',');
      filteredData = filteredData.filter(item => categories.includes(item.supt_biz_clsfc));
    }
    
    console.log(`[v1.3 백엔드] 🔍 필터링 완료! (결과: ${filteredData.length}개)`);

    // 4. 필터링된 데이터를 기준으로 페이지네이션 처리
    const totalItems = filteredData.length;
    const pageNum = parseInt(page, 10);
    const perPageNum = parseInt(perPage, 10);
    const startIndex = (pageNum - 1) * perPageNum;
    const endIndex = startIndex + perPageNum;
    const paginatedData = filteredData.slice(startIndex, endIndex);

    console.log(`[v1.3 백엔드] 📤 프론트엔드로 데이터 전송 (페이지: ${pageNum}, 개수: ${paginatedData.length}개, 필터링된 총 개수: ${totalItems}개)`);
    
    // 5. 최종 데이터를 프론트엔드에 전달 (현재 페이지 데이터 + 전체 아이템 개수)
    return {
      statusCode: 200,
      body: JSON.stringify({
        data: paginatedData,
        totalItems: totalItems,
      })
    };

  } catch (error) {
    console.error('[v1.3 백엔드] 🔥 치명적 오류 발생:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message })
    };
  }
};