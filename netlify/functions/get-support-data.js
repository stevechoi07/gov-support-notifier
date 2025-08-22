// 'node-fetch' 도구를 이전 방식(CommonJS require)으로 불러옵니다.
// package.json에 있는 버전과 완벽하게 호환됩니다.
const fetch = require('node-fetch');

// Netlify 서버리스 함수의 핵심 부분입니다.
exports.handler = async function(event, context) {
  try {
    // 1. 웹사이트가 요청한 데이터 개수(perPage)를 확인합니다.
    const perPage = event.queryStringParameters.perPage || '150';

    // 2. Netlify의 비밀 장소에서 API 키를 꺼내옵니다.
    const API_KEY = process.env.GOV_API_KEY;

    if (!API_KEY) {
      throw new Error("API 키가 설정되지 않았습니다.");
    }

    // 3. 정부 데이터 서버에 보낼 실제 주소를 조립합니다.
    const targetUrl = `http://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01?serviceKey=${encodeURIComponent(API_KEY)}&page=1&perPage=${perPage}&returnType=json`;

    // 4. 정부 서버에 데이터를 요청합니다.
    const response = await fetch(targetUrl);
    const data = await response.json();

    // 5. 성공적으로 받은 데이터를 웹사이트에 전달합니다.
    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };

  } catch (error) {
    // 만약 중간에 문제가 생기면, 에러 메시지를 전달합니다.
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message })
    };
  }
};