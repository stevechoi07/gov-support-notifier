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

  try {
    // 1. 정부 지원사업 API 데이터 가져오기 (실제 API 호출)
    // 이 부분은 사용자의 실제 API 엔드포인트에 맞춰 수정해야 합니다.
    // 여기서는 예시 데이터로 대체하겠습니다.
    const mockApiData = [
      { id: '12345' },
      { id: '67890' },
      { id: '98765' },
      { id: '43210' },
      { id: '77777' },
      { id: '88888' },
      { id: '99999' },
    ];
    
    // 이 부분에 실제 API를 호출하는 코드를 작성하세요.
    // 예시: const response = await fetch('https://api.example.com/gov-projects');
    // 예시: const data = await response.json();

    // 2. 가져온 데이터를 기반으로 URL 목록을 생성합니다.
    const baseUrl = 'https://kfund.ai'; // 사용자 웹앱의 기본 도메인
    const urlEntries = mockApiData.map(item => {
      // 무한스크롤 페이지 내 각 항목에 대한 고유 URL을 생성합니다.
      // 예시 URL: https://kfund.ai/?id=12345
      const loc = `${baseUrl}/?id=${item.id}`;
      return `  <url>
    <loc>${loc}</loc>
  </url>`;
    }).join('\n');

    // 3. 완전한 사이트맵 XML 문자열을 만듭니다.
    const sitemapContent = `${sitemapHeader}\n  <url>\n    <loc>${baseUrl}</loc>\n  </url>\n${urlEntries}\n${sitemapFooter}`;

    // 4. HTTP 응답을 반환합니다.
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