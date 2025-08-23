// /netlify/functions/login.js (TESTING VERSION)

exports.handler = async function(event) {
  // 이것은 Firebase 없이 연결만 확인하는 간단한 테스트 함수입니다.
  
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { password } = JSON.parse(event.body);
    // 테스트를 위한 간단한 비밀번호입니다.
    const correctPassword = "test"; 

    if (password === correctPassword) {
      // 비밀번호가 "test"이면, 성공 메시지를 보냅니다.
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: "Test login successful!", token: "fake-token-for-testing" }),
      };
    } else {
      return {
        statusCode: 401,
        body: JSON.stringify({ success: false, message: "테스트 비밀번호는 'test' 입니다." }),
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: "테스트 함수 실행에 실패했습니다." }),
    };
  }
};