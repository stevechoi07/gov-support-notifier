// v13.0: 이제 주방장은 요리하지 않습니다.
// 미리 만들어진 완벽한 밀키트(shops-data-with-coords.json)를
// 창고에서 꺼내 손님에게 바로 전달하는 역할만 합니다. 빛의 속도로!

// 미리 좌표 변환이 완료된 데이터를 불러옵니다.
const shopsData = require('./shops-data-with-coords.json');

exports.handler = async (event) => {
  // 어떤 요청이 오든, 그냥 준비된 전체 데이터를 바로 응답합니다.
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      // 캐시 설정을 추가하여 브라우저가 데이터를 잠시 저장하게 만듭니다. (성능 UP!)
      "Cache-Control": "public, max-age=3600", 
    },
    body: JSON.stringify(shopsData)
  };
};