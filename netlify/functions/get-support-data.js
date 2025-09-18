// js/get-support-data.js v2.1 - API 오류 처리 강화

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

    // ✨ [핵심 수정] 정부 API가 성공 응답('00')을 주었는지 먼저 확인합니다.
    if (data.response?.header?.resultCode !== '00') {
      // 성공이 아닐 경우, API가 보내준 에러 메시지를 전달합니다.
      throw new Error(data.response?.header?.resultMsg || '정부 API로부터 데이터를 가져오지 못했습니다.');
    }

    // 성공했을 때만 실제 데이터(items, totalCount)를 전달합니다.
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