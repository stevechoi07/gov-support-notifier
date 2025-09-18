// js/get-support-data.js v2.2 - 디버깅을 위해 API 원본 응답을 기록

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
    
    // ✨ [핵심 디버깅 코드] 정부 서버가 보낸 원본 응답을 그대로 출력합니다.
    console.log("정부 API 원본 응답:", responseText);

    const data = JSON.parse(responseText);

    if (data.response?.header?.resultCode !== '00') {
      throw new Error(data.response?.header?.resultMsg || '정부 API로부터 데이터를 가져오지 못했습니다.');
    }

    return {
      statusCode: 200,
      body: JSON.stringify(data.response.body) 
    };

  } catch (error) {
    console.error("Function Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: `서버 함수 오류: ${error.message}` })
    };
  }
};