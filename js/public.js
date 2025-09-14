// js/public.js v2.1 - 사용자 행동(노출/클릭) 추적 기능 추가

import { doc, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { firebaseReady, getFirestoreDB } from './firebase.js';
// ✨ pages.js와 cards.js에서 데이터 목록을 가져옵니다. (트래킹 대상 확인용)
import { pagesList } from './pages.js';
import { cards } from './cards.js';


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
    if (!container) { console.error("Content container not found!"); return; }
    if (contents.length === 0) { container.innerHTML = `<p class="text-center text-gray-500">표시할 콘텐츠가 없습니다.</p>`; return; }

    const contentHtml = contents.map(content => {
        if (content.adType) {
            // === 카드(Card) 렌더링 ===
            let mediaHtml = '';
            if (content.mediaUrl) {
                if (content.mediaType === 'video') {
                    mediaHtml = `<div class="card-media-wrapper"><video src="${content.mediaUrl}" autoplay loop muted playsinline></video></div>`;
                } else {
                    mediaHtml = `<div class="card-media-wrapper"><img src="${content.mediaUrl}" alt="${content.title || '카드 이미지'}"></div>`;
                }
            }
            const partnersText = content.isPartners ? `<p class="partners-text">이 포스팅은 쿠팡 파트-너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>` : '';
            
            // ✨ [핵심] 식별을 위해 data-id 속성을 추가합니다.
            const cardInnerHtml = `
                <div class="card" data-observe-target data-id="${content.id}">
                    ${mediaHtml}
                    <div class="card-content">
                        <h2>${content.title || '제목 없음'}</h2>
                        <p>${content.description || ' '}</p>
                        ${partnersText}
                    </div>
                </div>
            `;
            
            if (content.link) {
                return `<a href="${content.link}" target="_blank" rel="noopener noreferrer" class="card-link">${cardInnerHtml}</a>`;
            } else {
                return cardInnerHtml;
            }
        } else {
            // === 페이지(Page) 렌더링 ===
            const pageSettings = content.pageSettings || {};
            let pageStyle = `background-color: ${pageSettings.bgColor || 'transparent'};`;
            if (pageSettings.viewport) {
                const [widthStr, heightStr] = pageSettings.viewport.split(',');
                const width = parseFloat(widthStr);
                const height = parseFloat(heightStr);
                if (height > 0) {
                    pageStyle += ` aspect-ratio: ${width} / ${height};`;
                }
            }
            const bgMediaHtml = pageSettings.bgVideo ? `<video class="page-background-video" src="${pageSettings.bgVideo}" autoplay loop muted playsinline></video>` : pageSettings.bgImage ? `<div class="page-background-image" style="background-image: url('${pageSettings.bgImage}');"></div>` : '';
            const componentsHtml = (content.components || []).map(component => {
                const componentStyle = stylesToString(component.styles);
                switch (component.type) {
                    case 'heading':
                        return `<h1 class="page-component" style="${componentStyle}">${component.content}</h1>`;
                    case 'paragraph':
                        return `<p class="page-component" style="${componentStyle}">${component.content}</p>`;
                    case 'button':
                        return `<a href="${component.link || '#'}" class="page-button page-component" style="${componentStyle}" target="_blank" rel="noopener noreferrer">${component.content}</a>`;
                    default:
                        return '';
                }
            }).join('');

            // ✨ [핵심] 식별을 위해 data-id 속성을 추가합니다.
            return `
                <div class="page-section" data-observe-target data-id="${content.id}" style="${pageStyle}">
                    ${bgMediaHtml}
                    <div class="page-content-wrapper">
                        ${componentsHtml}
                    </div>
                </div>
            `;
        }
    }).join('');

    container.innerHTML = contentHtml;
    setupIntersectionObserver();
}

// ✨ 노출(Impression)을 기록하는 함수
async function trackImpression(contentId) {
    if (!contentId) return;
    // cards.list에 해당 ID가 없으면 카드 콘텐츠가 아니므로 함수를 종료합니다.
    if (!cards.list.some(card => card.id === contentId)) return;
    
    try {
        const db = getFirestoreDB();
        const contentRef = doc(db, 'ads', contentId);
        await updateDoc(contentRef, {
            viewCount: increment(1)
        });
        console.log(`Impression tracked for: ${contentId}`);
    } catch (error) {
        console.error("Error tracking impression:", error);
    }
}

// ✨ 클릭(Click)을 기록하는 함수
async function trackClick(contentId) {
    if (!contentId) return;
    // cards.list에 해당 ID가 없으면 카드 콘텐츠가 아니므로 함수를 종료합니다.
    if (!cards.list.some(card => card.id === contentId)) return;

    try {
        const db = getFirestoreDB();
        const contentRef = doc(db, 'ads', contentId);
        await updateDoc(contentRef, {
            clickCount: increment(1)
        });
        console.log(`Click tracked for: ${contentId}`);
    } catch (error) {
        console.error("Error tracking click:", error);
    }
}

// ✨ Intersection Observer가 노출을 기록하도록 수정된 함수
function setupIntersectionObserver() {
    let visibleElements = new Map();
    let currentActive = null;
    const trackedImpressions = new Set();

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
            if (currentActive) { currentActive.classList.remove('is-visible'); }
            mostVisibleElement.classList.add('is-visible');
            currentActive = mostVisibleElement;
        }
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                visibleElements.set(entry.target, entry);
                const contentId = entry.target.dataset.id;
                
                if (contentId && !trackedImpressions.has(contentId)) {
                    trackImpression(contentId);
                    trackedImpressions.add(contentId);
                }
            } else {
                visibleElements.delete(entry.target);
                entry.target.classList.remove('is-visible');
                if(entry.target === currentActive) currentActive = null;
            }
        });
        updateActive();
    }, { threshold: Array.from({ length: 101 }, (_, i) => i / 100) });

    const targets = document.querySelectorAll('[data-observe-target]');
    targets.forEach(target => observer.observe(target));
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

// ✨ 페이지 전체에 클릭 리스너를 추가합니다.
document.addEventListener('click', (event) => {
    const targetElement = event.target.closest('[data-id]');
    if (targetElement) {
        const contentId = targetElement.dataset.id;
        trackClick(contentId);
    }
});

renderPublicPage();