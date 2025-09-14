// js/public.js v2.0 - '가장 주목받는 콘텐츠' 하이라이트 기능

import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { firebaseReady, getFirestoreDB } from './firebase.js';

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
        // ✨ [핵심] 각 콘텐츠 최상위 요소에 'data-observe-target' 속성을 추가하여 감시 대상을 명확히 합니다.
        if (content.adType) {
            // Card rendering
            let mediaHtml = ''; if (content.mediaUrl) { if (content.mediaType === 'video') { mediaHtml = `<div class="card-media-wrapper"><video src="${content.mediaUrl}" autoplay loop muted playsinline></video></div>`; } else { mediaHtml = `<div class="card-media-wrapper"><img src="${content.mediaUrl}" alt="${content.title || '카드 이미지'}"></div>`; } } const partnersText = content.isPartners ? `<p class="partners-text">이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>` : '';
            const cardInnerHtml = `<div class="card" data-observe-target>${mediaHtml}<div class="card-content"><h2>${content.title || '제목 없음'}</h2><p>${content.description || ' '}</p>${partnersText}</div></div>`;
            if (content.link) { return `<a href="${content.link}" target="_blank" rel="noopener noreferrer" class="card-link">${cardInnerHtml}</a>`; } else { return cardInnerHtml; }
        } else {
            // Page rendering
            const pageSettings = content.pageSettings || {}; let pageStyle = `background-color: ${pageSettings.bgColor || 'transparent'};`; if (pageSettings.viewport) { const [widthStr, heightStr] = pageSettings.viewport.split(','); const width = parseFloat(widthStr); const height = parseFloat(heightStr); if (height > 0) { pageStyle += ` aspect-ratio: ${width} / ${height};`; } } const bgMediaHtml = pageSettings.bgVideo ? `<video class="page-background-video" src="${pageSettings.bgVideo}" autoplay loop muted playsinline></video>` : pageSettings.bgImage ? `<div class="page-background-image" style="background-image: url('${pageSettings.bgImage}');"></div>` : ''; const componentsHtml = (content.components || []).map(component => { const componentStyle = stylesToString(component.styles); switch (component.type) { case 'heading': return `<h1 class="page-component" style="${componentStyle}">${component.content}</h1>`; case 'paragraph': return `<p class="page-component" style="${componentStyle}">${component.content}</p>`; case 'button': return `<a href="${component.link || '#'}" class="page-button page-component" style="${componentStyle}" target="_blank" rel="noopener noreferrer">${component.content}</a>`; default: return ''; } }).join('');
            return `<div class="page-section" style="${pageStyle}" data-observe-target>${bgMediaHtml}<div class="page-content-wrapper">${componentsHtml}</div></div>`;
        }
    }).join('');

    container.innerHTML = contentHtml;
    
    setupIntersectionObserver();
}

// ✨ [핵심 수정] '가장 주목받는 콘텐츠'를 찾아내는 Intersection Observer 로직
function setupIntersectionObserver() {
    let visibleElements = new Map(); // 화면에 보이는 요소들을 추적하기 위한 Map
    let currentActive = null; // 현재 활성화된(테두리가 보이는) 요소

    // 화면에 보이는 요소들 중 가장 주목받는 요소를 찾아 활성화하는 함수
    const updateActive = () => {
        let maxRatio = 0;
        let mostVisibleElement = null;

        visibleElements.forEach((entry, element) => {
            if (entry.intersectionRatio > maxRatio) {
                maxRatio = entry.intersectionRatio;
                mostVisibleElement = element;
            }
        });

        if (mostVisibleElement && mostVisibleElement !== currentActive) {
            // 기존 활성 요소 비활성화
            if (currentActive) {
                currentActive.classList.remove('is-visible');
            }
            // 새 요소 활성화
            mostVisibleElement.classList.add('is-visible');
            currentActive = mostVisibleElement;
        }
    };

    const options = {
        root: null,
        rootMargin: '0px',
        // threshold를 여러 개 두어, 스크롤 중 더 자주 감지하도록 설정
        threshold: Array.from({ length: 101 }, (_, i) => i / 100)
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // 화면에 보이면 Map에 추가/업데이트
                visibleElements.set(entry.target, entry);
            } else {
                // 화면에서 사라지면 Map에서 제거
                visibleElements.delete(entry.target);
                entry.target.classList.remove('is-visible'); // 즉시 비활성화
                if(entry.target === currentActive) currentActive = null;
            }
        });
        // 변경이 있을 때마다 '주인공'을 다시 계산
        updateActive();
    }, options);

    const targets = document.querySelectorAll('[data-observe-target]');
    targets.forEach(target => observer.observe(target));
}


async function renderPublicPage() {
    // ... (이하 동일)
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