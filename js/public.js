// js/public.js v1.1 - 콘텐츠 렌더링 기능 추가

import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { firebaseReady, getFirestoreDB } from './firebase.js';

// ✨ ID 배열을 받아, 각 문서의 상세 데이터를 Firestore에서 가져오는 함수
async function fetchContentDetails(ids) {
    const db = getFirestoreDB();
    if (!ids || ids.length === 0) return [];

    const contentPromises = ids.map(async (id) => {
        if (!id) return null;

        // pages 컬렉션에서 먼저 찾아봅니다.
        let contentRef = doc(db, 'pages', id);
        let contentSnap = await getDoc(contentRef);

        // pages에 없으면 ads 컬렉션에서 다시 찾아봅니다.
        if (!contentSnap.exists()) {
            contentRef = doc(db, 'ads', id);
            contentSnap = await getDoc(contentRef);
        }
        
        // 찾은 문서가 존재하면 데이터와 함께 id를 반환합니다.
        return contentSnap.exists() ? { id: contentSnap.id, ...contentSnap.data() } : null;
    });

    const contents = await Promise.all(contentPromises);
    return contents.filter(Boolean); // null 값을 제거하고 반환합니다.
}

// ✨ 콘텐츠 데이터 배열을 받아 HTML을 생성하고 화면에 렌더링하는 함수
function renderAllContent(contents) {
    const container = document.getElementById('content-container');
    if (!container) {
        console.error("Content container not found!");
        return;
    }

    if (contents.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-500">표시할 콘텐츠가 없습니다.</p>`;
        return;
    }

    // 각 콘텐츠 유형에 맞는 HTML을 생성합니다.
    const contentHtml = contents.map(content => {
        // adType 속성이 있으면 '카드', 없으면 '페이지'로 간주합니다.
        if (content.adType) { 
            // === 카드(Card) 렌더링 ===
            return `
                <div class="card bg-white shadow-lg rounded-lg overflow-hidden my-8">
                    ${content.mediaUrl ? `<img src="${content.mediaUrl}" alt="${content.title}" class="w-full h-auto">` : ''}
                    <div class="p-6">
                        <h2 class="text-2xl font-bold mb-2">${content.title}</h2>
                        <p class="text-gray-700">${content.description || ''}</p>
                    </div>
                </div>
            `;
        } else {
            // === 페이지(Page) 렌더링 ===
            // 페이지는 간단하게 이름만 표시하도록 설정 (향후 컴포넌트 렌더링으로 확장 가능)
            return `
                <div class="page-section my-8 p-6 bg-gray-200 rounded-lg">
                    <h1 class="text-3xl font-bold">${content.name}</h1>
                    <p class="text-gray-600 mt-2">이곳에 '${content.name}' 페이지의 상세 컴포넌트가 렌더링됩니다.</p>
                </div>
            `;
        }
    }).join('');

    container.innerHTML = contentHtml;
}


// ✨ 사용자 페이지를 렌더링하는 메인 함수
async function renderPublicPage() {
    const container = document.getElementById('content-container');
    console.log("🚀 Public page script loaded. Waiting for Firebase...");

    try {
        await firebaseReady;
        const db = getFirestoreDB();
        console.log("✅ Firebase is ready. Fetching layout data...");

        const layoutRef = doc(db, 'layouts', 'mainLayout');
        const layoutSnap = await getDoc(layoutRef);

        if (layoutSnap.exists()) {
            const contentIds = layoutSnap.data().contentIds;
            console.log("🎉 Layout IDs to render:", contentIds);

            // ✨ [핵심] ID로 상세 데이터를 가져온 후, HTML로 렌더링합니다.
            const contents = await fetchContentDetails(contentIds);
            console.log("📦 Fetched content details:", contents);
            renderAllContent(contents);

        } else {
            console.error("🔥 Error: 'mainLayout' document not found!");
            if (container) container.innerHTML = `<p class="text-center text-red-500">레이아웃 정보를 찾을 수 없습니다.</p>`;
        }

    } catch (error) {
        console.error("🔥 An error occurred:", error);
        if (container) container.innerHTML = `<p class="text-center text-red-500">페이지를 불러오는 중 오류가 발생했습니다.</p>`;
    }
}

// ✨ 메인 함수를 실행합니다.
renderPublicPage();