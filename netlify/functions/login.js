// /netlify/functions/login.js

exports.handler = async function(event) {
  // 1. 이 함수는 POST 방식으로만 요청을 받습니다. 다른 방식이면 거절해요.
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405, // 405: Method Not Allowed (허용되지 않은 방식)
      body: JSON.stringify({ message: "POST 요청만 허용됩니다." }),
    };
  }

  try {
    // 2. admin.html에서 보낸 비밀번호를 안전하게 꺼내요.
    const body = JSON.parse(event.body);
    const providedPassword = body.password;

    // 3. Netlify의 '비밀 금고'(환경 변수)에 저장된 진짜 비밀번호를 가져와요.
    const correctPassword = process.env.ADMIN_PASSWORD;

    // 4. 두 비밀번호가 일치하는지 확인해요.
    if (providedPassword === correctPassword) {
      // 4-1. 일치하면 "성공!" 신호를 보냅니다.
      return {
        statusCode: 200, // 200: OK (성공)
        body: JSON.stringify({ success: true, message: "로그인 성공!" }),
      };
    } else {
      // 4-2. 일치하지 않으면 "실패!" 신호를 보냅니다.
      return {
        statusCode: 401, // 401: Unauthorized (인증 실패)
        body: JSON.stringify({ success: false, message: "비밀번호가 틀렸습니다." }),
      };
    }
  } catch (error) {
    // 5. 만약 위 과정에서 예상치 못한 다른 문제가 생기면, 서버 오류 신호를 보냅니다.
    console.error("로그인 함수 오류:", error);
    return {
      statusCode: 500, // 500: Internal Server Error (서버 내부 오류)
      body: JSON.stringify({ success: false, message: "서버 내부 오류가 발생했습니다." }),
    };
  }
};