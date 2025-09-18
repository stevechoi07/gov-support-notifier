// get-support-data.js (v2.0)
// 'node-fetch' 도구를 이전 방식(CommonJS require)으로 불러옵니다.
const fetch = require('node-fetch');

// Netlify 서버리스 함수의 핵심 부분입니다.
exports.handler = async function(event, context) {
  try {
    // 1. ✨ 웹사이트가 요청한 '페이지 번호'와 '개수'를 확인합니다.
    const perPage = event.queryStringParameters.perPage || '12'; // 기본값을 12로 변경
    const page = event.queryStringParameters.page || '1';     // 페이지 번호 추가 (기본값 1)

    // 2. Netlify의 비밀 장소에서 API 키를 꺼내옵니다.
    const API_KEY = process.env.GOV_API_KEY;

    if (!API_KEY) {
      throw new Error("API 키가 설정되지 않았습니다.");
    }

    // 3. ✨ 정부 데이터 서버에 보낼 주소를 동적으로 조립합니다.
    const targetUrl = `http://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01?serviceKey=${encodeURIComponent(API_KEY)}&pageNo=${page}&numOfRows=${perPage}&returnType=json`;

    // 4. 정부 서버에 데이터를 요청합니다.
    const response = await fetch(targetUrl);
    // 정부 API가 가끔 텍스트 형식으로 응답할 때가 있어, 먼저 텍스트로 받은 후 JSON으로 파싱합니다.
    const responseText = await response.text();
    const data = JSON.parse(responseText);

    if (!response.ok) {
        throw new Error(data.resultMsg || `API 서버 오류: ${response.status}`);
    }

    // 5. 성공적으로 받은 데이터를 웹사이트에 전달합니다.
    return {
      statusCode: 200,
      body: JSON.stringify(data.response.body) // 실제 데이터는 response.body 안에 있습니다.
    };

  } catch (error) {
    // 만약 중간에 문제가 생기면, 에러 메시지를 전달합니다.
    console.error("Function Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: `서버 함수 오류: ${error.message}` })
    };
  }
};