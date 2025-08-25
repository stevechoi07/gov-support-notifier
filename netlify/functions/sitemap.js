// Netlify 서버리스 함수는 Node.js 환경에서 실행됩니다.
// 이 함수는 HTTP 요청이 들어올 때마다 실행되어 동적으로 사이트맵을 생성합니다.

// 'node-fetch' 라이브러리는 서버 환경에서 fetch API를 사용하기 위해 필요합니다.
// 이 코드를 사용하려면 'package.json'에 의존성 추가가 필요합니다.
// 넷플리파이는 자동으로 esbuild를 사용해 라이브러리를 번들링합니다.
// npm install node-fetch@2.6.1 을 실행하여 의존성을 추가해 주세요.
const fetch = require('node-fetch');

/**
 * Netlify 함수 핸들러
 * @param {object} event - HTTP 요청에 대한 정보 (예: 경로, 헤더, 본문)
 * @param {object} context - 함수 실행에 대한 정보 (예: 사용자 인증)
 * @returns {object} 응답 객체 (HTTP 상태 코드, 헤더, 본문 포함)
 */
exports.handler = async (event, context) => {
  // Sitemaps.org 표준 XML 헤더와 푸터
  const sitemapHeader = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
  const sitemapFooter = `</urlset>`;

  try {
    // 1. 환경 변수에서 API 키를 안전하게 불러옵니다.
    // 'GOV_API_KEY'는 넷플리파이 설정에서 직접 등록해야 합니다.
    const serviceKey = process.env.GOV_API_KEY;
    if (!serviceKey) {
      throw new Error("API 키가 설정되지 않았습니다.");
    }
    
    // 2. 정부 데이터 서버에 보낼 실제 주소를 조립합니다.
    const targetUrl = `http://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01?serviceKey=${encodeURIComponent(serviceKey)}&page=1&perPage=150&returnType=json`;

    // 3. 정부 서버에 데이터를 요청합니다.
    const response = await fetch(targetUrl);
    if (!response.ok) {
        throw new Error(`API request failed with status: ${response.status}`);
    }
    const apiData = await response.json();

    // 4. 가져온 데이터를 기반으로 URL 목록을 생성합니다.
    const baseUrl = 'https://kfund.ai'; // 사용자 웹앱의 기본 도메인
    
    // API 응답 구조에 맞춰 데이터 배열을 가져옵니다.
    // 실제 API 응답 구조를 확인하고 'data.items'와 같이 수정해야 합니다.
    const items = apiData.items || [];
    
    const urlEntries = items.map(item => {
      // 무한스크롤 페이지 내 각 항목에 대한 고유 URL을 생성합니다.
      // 예시 URL: https://kfund.ai/?id=12345
      const loc = `${baseUrl}/?id=${item.id}`;
      return `  <url>
    <loc>${loc}</loc>
  </url>`;
    }).join('\n');

    // 5. 완전한 사이트맵 XML 문자열을 만듭니다.
    const sitemapContent = `${sitemapHeader}\n  <url>\n    <loc>${baseUrl}</loc>\n  </url>\n${urlEntries}\n${sitemapFooter}`;

    // 6. HTTP 응답을 반환합니다.
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/xml', // 사이트맵은 XML 형식이므로 이 헤더가 필수입니다.
      },
      body: sitemapContent,
    };
  } catch (error) {
    // 오류가 발생하면 오류 응답을 반환합니다.
    console.error('Sitemap 생성 중 오류 발생:', error);
    return {
      statusCode: 500,
      body: `Error generating sitemap: ${error.message}`,
    };
  }
};