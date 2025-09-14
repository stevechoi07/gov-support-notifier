// js/public.js v1.9 - Intersection Observer로 스크롤 애니메이션 추가

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
            const partnersText = content.isPartners ? `<p class="partners-text">이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>` : '';
            
            const cardInnerHtml = `
                <div class="card">
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

            return `
                <div class="page-section" style="${pageStyle}">
                    ${bgMediaHtml}
                    <div class="page-content-wrapper">
                        ${componentsHtml}
                    </div>
                </div>
            `;
        }
    }).join('');

    container.innerHTML = contentHtml;
    
    // 콘텐츠 렌더링 후, Intersection Observer를 설정합니다.
    setupIntersectionObserver();
}

// Intersection Observer 설정 및 실행 함수
function setupIntersectionObserver() {
    const options = {
        root: null,
        rootMargin: '0px',
        threshold: 0.2
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, options);

    // 감시할 대상을 모두 선택합니다. 
    // .card-link가 있는 경우 그 부모를, 아니면 .card 자체를 감시해야 합니다.
    const targets = document.querySelectorAll('.card, .page-section');
    targets.forEach(target => {
        // card-link의 부모는 <a> 태그이므로, 실제 감시 대상은 그 안의 .card 입니다.
        // 이 코드에서는 .card와 .page-section을 직접 감시하면 되므로 복잡한 로직이 필요 없습니다.
        observer.observe(target);
    });
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
            if (container) container.innerHTML = `<p class="text-center text-red-500">레이웃 정보를 찾을 수 없습니다.</p>`;
        }
    } catch (error) {
        console.error("🔥 An error occurred:", error);
        if (container) container.innerHTML = `<p class="text-center text-red-500">페이지를 불러오는 중 오류가 발생했습니다.</p>`;
    }
}

renderPublicPage();