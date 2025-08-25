// Netlify 서버리스 함수는 Node.js 환경에서 실행됩니다.
// 이 함수는 HTTP 요청이 들어올 때마다 실행되어 동적으로 사이트맵을 생성합니다.

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
  const version = "1.0.7"; // 이 부분을 원하는 버전으로 변경하세요.

  try {
    // 1. 공공데이터포털 API를 직접 호출하는 대신,
    //    이미 만들어둔 `/api/get-support-data` 함수를 호출합니다.
    const perPage = '150'; // 한 번에 가져올 데이터 개수
    const targetUrl = `https://kfund.ai/api/get-support-data?perPage=${perPage}`;

    // 2. 우리 웹앱의 프록시 함수에 데이터를 요청합니다.
    // 이제 Node.js의 내장 fetch API를 사용합니다.
    const response = await fetch(targetUrl);
    if (!response.ok) {
        throw new Error(`Proxy API request failed with status: ${response.status}`);
    }
    const apiData = await response.json();

    // 3. 가져온 데이터를 기반으로 URL 목록을 생성합니다.
    const baseUrl = 'https://kfund.ai'; // 사용자 웹앱의 기본 도메인
    
    // API 응답 구조에 맞춰 데이터 배열을 가져옵니다.
    // 'data' 속성 안에 'data' 속성이 또 있는지 확인
    const items = (apiData.data && apiData.data.data) ? apiData.data.data : apiData.data || [];
    
    if (items.length === 0) {
      console.log('No items found in API response.');
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/xml' },
        body: `${sitemapHeader}\n<!-- Sitemap Version: ${version} -->\n  <url>\n    <loc>${baseUrl}</loc>\n  </url>\n${sitemapFooter}`
      };
    }
    
    const urlEntries = items.map(item => {
      // 무한스크롤 페이지 내 각 항목에 대한 고유 URL을 생성합니다.
      // 예시 URL: https://kfund.ai/?id=${item.id}
      const loc = `${baseUrl}/?id=${item.id}`;
      return `  <url>
    <loc>${loc}</loc>
  </url>`;
    }).join('\n');

    // 4. 완전한 사이트맵 XML 문자열을 만듭니다.
    const sitemapContent = `${sitemapHeader}
<!-- Sitemap Version: ${version} -->
  <url>
    <loc>${baseUrl}</loc>
  </url>
${urlEntries}
${sitemapFooter}`;

    // 5. HTTP 응답을 반환합니다.
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