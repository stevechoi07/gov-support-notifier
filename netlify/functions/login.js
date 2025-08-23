// /netlify/functions/login.js

// 이 파일은 프로젝트의 netlify/functions 폴더 안에 저장해야 합니다.
// 진짜 비밀번호는 이 파일 안에 안전하게 보관됩니다.
const CORRECT_PASSWORD = "rmfpdlxmxmfl!!"; // 실제 운영 시에는 더 복잡한 비밀번호를 사용하세요.

exports.handler = async function(event, context) {
  // POST 요청만 처리하도록 설정
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  }

  try {
    const { password } = JSON.parse(event.body);

    if (password === CORRECT_PASSWORD) {
      // 비밀번호가 맞으면 성공 응답
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: "Login successful" }),
      };
    } else {
      // 비밀번호가 틀리면 실패 응답
      return {
        statusCode: 401,
        body: JSON.stringify({ success: fal