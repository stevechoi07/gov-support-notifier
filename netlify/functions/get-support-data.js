// js/get-support-data.js v2.4 (최종 수정) - 올바른 API 응답 구조 반영

const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  try {
    const perPage = event.queryStringParameters.perPage || '12';
    const page = event.queryStringParameters.page || '1';

    const API_KEY = process.env.GOV_API_KEY;
    if (!API_KEY) {
      throw new Error("API 키가 설정되지 않았습니다.");
    }

    const targetUrl = `http://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01?serviceKey=${encodeURIComponent(API_KEY)}&pageNo=${page}&numOfRows=${perPage}&returnType=json`;

    const response = await fetch(targetUrl);
    const responseText = await response.text();
    const data = JSON.parse(responseText);

    // ✨ [핵심 수정] 
    // 실제 API 응답에 'data' 속성이 있고, 그것이 배열인지 확인합니다.
    if (data && Array.isArray(data.data)) {
        // 웹사이트(프론트엔드)가 기대하는 형식인 { items, totalCount }로 재조립해서 전달합니다.
        return {
            statusCode: 200,
            body: JSON.stringify({
                items: data.data,
                totalCount: data.totalCount
            })
        };
    } else {
        // API가 성공했지만 데이터가 없는 경우 또는 예기치 않은 구조일 경우
        throw new Error('정부 API로부터 유효한 데이터 목록을 받지 못했습니다.');
    }

  } catch (error) {
    console.error("🔥 함수 실행 중 심각한 오류 발생:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: `서버 함수 오류: ${error.message}` })
    };
  }
};