// js/get-support-data.js v2.3 - 모든 단계를 기록하는 최종 디버깅 코드

const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  // 1. 함수 실행 시작을 알립니다.
  console.log("🚀 get-support-data 함수 실행 시작");

  try {
    const perPage = event.queryStringParameters.perPage || '12';
    const page = event.queryStringParameters.page || '1';

    const API_KEY = process.env.GOV_API_KEY;
    if (!API_KEY) {
      throw new Error("API 키가 설정되지 않았습니다.");
    }
    
    // 2. 어떤 주소로 요청을 보낼지 로그로 기록합니다.
    const targetUrl = `http://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01?serviceKey=${encodeURIComponent(API_KEY)}&pageNo=${page}&numOfRows=${perPage}&returnType=json`;
    console.log("📡 요청할 API 주소:", targetUrl);

    // 3. 정부 서버에 데이터를 요청하고 응답을 기다립니다.
    const response = await fetch(targetUrl);
    
    // 4. 응답의 상태 코드와 헤더를 로그로 기록합니다.
    console.log("📥 응답 상태 코드:", response.status);
    console.log("📥 응답 헤더:", JSON.stringify(response.headers.raw()));

    const responseText = await response.text();
    
    // 5. 정부 서버가 보낸 원본 응답을 그대로 로그로 기록합니다.
    console.log("📜 정부 API 원본 응답:", responseText);

    // 6. 이제 데이터를 파싱하고 검증합니다.
    const data = JSON.parse(responseText);

    if (data.response?.header?.resultCode !== '00') {
      throw new Error(data.response?.header?.resultMsg || '정부 API로부터 데이터를 가져오지 못했습니다.');
    }

    console.log("✅ 성공적으로 데이터를 처리했습니다.");
    return {
      statusCode: 200,
      body: JSON.stringify(data.response.body) 
    };

  } catch (error) {
    console.error("🔥 함수 실행 중 심각한 오류 발생:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: `서버 함수 오류: ${error.message}` })
    };
  }
};