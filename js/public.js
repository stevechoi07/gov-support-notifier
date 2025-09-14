// js/public.js v1.2 - 페이지 컴포넌트 및 비디오 렌더링 완전 지원

import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { firebaseReady, getFirestoreDB } from './firebase.js';

// ✨ [추가] 자바스크립트 스타일 객체를 인라인 스타일 문자열로 변환하는 헬퍼 함수
function stylesToString(styles = {}) {
    return Object.entries(styles)
        .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value};`)
        .join(' ');
}

async function fetchContentDetails(ids) {
    const db = getFirestoreDB();
    if (!ids || ids.length === 0) return [];

    const contentPromises = ids.map(async (id) => {
        if (!id) return null;
        let contentRef = doc(db, 'pages', id);
        let contentSnap = await getDoc(contentRef);
        if (!contentSnap.exists()) {
            contentRef = doc(db, 'ads', id);
            contentSnap = await getDoc(contentRef);
        }
        return contentSnap.exists() ? { id: contentSnap.id, ...contentSnap.data() } : null;
    });

    const contents = await Promise.all(contentPromises);
    return contents.filter(Boolean);
}

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

    const contentHtml = contents.map(content => {
        if (content.adType) {
            // === 카드(Card) 렌더링 ===
            // ✨ [수정] mediaType을 확인하여 비디오와 이미지를 다르게 처리합니다.
            let mediaHtml = '';
            if (content.mediaUrl) {
                if (content.mediaType === 'video') {
                    mediaHtml = `<video src="${content.mediaUrl}" autoplay loop muted playsinline class="w-full h-auto"></video>`;
                } else {
                    mediaHtml = `<img src="${content.mediaUrl}" alt="${content.title}" class="w-full h-auto">`;
                }
            }
            return `
                <div class="card">
                    ${mediaHtml}
                    <div class="p-6">
                        <h2 class="text-2xl font-bold mb-2">${content.title}</h2>
                        <p class="text-gray-700">${content.description || ''}</p>
                    </div>
                </div>
            `;
        } else {
            // === 페이지(Page) 렌더링 ===
            // ✨ [수정] 페이지 설정(배경 등)과 컴포넌트 배열을 읽어서 전체 페이지를 구성합니다.
            const pageSettings = content.pageSettings || {};
            const pageStyle = `background-color: ${pageSettings.bgColor || 'transparent'}; ${pageSettings.bgImage ? `background-image: url('${pageSettings.bgImage}');` : ''}`;

            const componentsHtml = (content.components || []).map(component => {
                const componentStyle = stylesToString(component.styles);
                switch (component.type) {
                    case 'heading':
                        return `<h1 class="page-component" style="${componentStyle}">${component.content}</h1>`;
                    case 'paragraph':
                        return `<p class="page-component" style="${componentStyle}">${component.content}</p>`;
                    case 'button':
                        return `<a href="${component.link || '#'}" class="page-button page-component" style="${componentStyle}" target="_blank" rel="noopener noreferrer">${component.content}</a>`;
                    // 향후 다른 컴포넌트 유형도 여기에 추가할 수 있습니다.
                    default:
                        return '';
                }
            }).join('');

            return `
                <div class="page-section" style="${pageStyle}">
                    <div class="page-content-wrapper">
                        ${componentsHtml}
                    </div>
                </div>
            `;
        }
    }).join('');

    container.innerHTML = contentHtml;
}

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

renderPublicPage();