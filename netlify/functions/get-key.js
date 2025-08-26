// Netlify 서버리스 함수의 기본 양식입니다.
// 이 코드는 Netlify의 서버에서만 안전하게 실행됩니다.

exports.handler = async function(event, context) {
  try {
    // Netlify 환경 변수에 저장된 카카오 API 키를 불러옵니다.
    // 이 'process.env.KAKAO_API_KEY'는 Netlify 사이트 설정에서 직접 입력해야 합니다.
    const apiKey = process.env.KAKAO_API_KEY;

    // 만약 관리자가 Netlify에 키를 등록하는 것을 잊었을 경우를 대비한 안전장치입니다.
    if (!apiKey) {
      // 에러를 발생시켜 아래 catch 블록으로 즉시 이동시킵니다.
      throw new Error("카카오 API 키가 서버에 설정되지 않았습니다. Netlify 관리자 페이지에서 환경 변수를 확인해주세요.");
    }

    // 성공적으로 키를 찾았으면, JSON 형태로 응답합니다.
    // 이 응답은 finder.html의 '집사 호출' 코드로 전달됩니다.
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ apiKey: apiKey })
    };

  } catch (error) {
    // 만약 위에서 에러가 발생하면, 여기서 잡아서 에러 메시지를 보냅니다.
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: error.message })
    };
  }
};