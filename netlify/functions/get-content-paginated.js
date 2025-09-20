// netlify/functions/get-content-paginated.js

// 이곳에 원래 사용하시던 콘텐츠 데이터를 가져오는 로직을 넣어주세요.
// 예시를 위해 임시 데이터로 구성했습니다.
const allContentData = [
    // ... 여기에 모든 콘텐츠 객체들이 들어있다고 가정합니다.
    // 예: { id: '1', name: '페이지 1', ... }, { id: '2', adType: 'card', ... }
];

exports.handler = async (event, context) => {
    // 1. 클라이언트가 요청한 페이지 번호와 페이지 당 아이템 수를 가져옵니다.
    const page = parseInt(event.queryStringParameters.page) || 1;
    const limit = parseInt(event.queryStringParameters.limit) || 5; // 한 번에 5개씩 로드

    // 2. 전체 데이터에서 요청된 페이지에 해당하는 부분을 계산합니다.
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    
    // 3. 계산된 부분만큼 데이터를 잘라냅니다.
    const paginatedData = allContentData.slice(startIndex, endIndex);

    // 4. 잘라낸 데이터와 전체 아이템 수를 함께 클라이언트에 보냅니다.
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            data: paginatedData,
            totalItems: allContentData.length,
        }),
    };
};