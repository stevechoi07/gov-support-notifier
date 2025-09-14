// js/public.js v1.0 - 레이아웃 데이터 로딩 테스트

// ✨ 필요한 Firebase 함수들과, 우리가 만든 firebase.js의 헬퍼 함수들을 가져옵니다.
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { firebaseReady, getFirestoreDB } from './firebase.js';

// ✨ 사용자 페이지를 렌더링하는 메인 함수
async function renderPublicPage() {
    console.log("🚀 Public page script loaded. Waiting for Firebase...");

    try {
        // Firebase가 준비될 때까지 기다립니다.
        await firebaseReady;
        const db = getFirestoreDB();
        console.log("✅ Firebase is ready. Fetching layout data...");

        // 'layouts' 컬렉션의 'mainLayout' 문서를 가리킵니다.
        const layoutRef = doc(db, 'layouts', 'mainLayout');
        // 해당 문서를 가져옵니다.
        const layoutSnap = await getDoc(layoutRef);

        if (layoutSnap.exists()) {
            // 문서가 존재하면, contentIds 배열을 가져옵니다.
            const contentIds = layoutSnap.data().contentIds;
            
            // ✨ [핵심 테스트] 브라우저 콘솔에 ID 목록을 출력해봅니다.
            console.log("🎉 Layout IDs to render:", contentIds);

            // TODO: 다음 단계에서 이 ID들을 가지고 실제 콘텐츠를 가져와서 HTML로 그릴 예정입니다.

        } else {
            console.error("🔥 Error: 'mainLayout' document not found!");
            // TODO: 레이아웃 문서가 없을 때 사용자에게 보여줄 메시지를 처리합니다.
        }

    } catch (error) {
        console.error("🔥 An error occurred:", error);
    }
}

// ✨ 메인 함수를 실행합니다.
renderPublicPage();