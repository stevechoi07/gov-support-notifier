// js/public.js v3.8 - 구독 성공 시 로드된 모든 콘텐츠를 즉시 다시 렌더링

import { doc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { firebaseReady, getFirestoreDB } from './firebase.js';
import { showToast } from './ui.js';

let swiperInstance = null;
let storyTimer = null;
let allContent = []; // 모든 콘텐츠를 여기에 한번에 저장합니다.
let loadedContentIndex = 0;
const INITIAL_LOAD_COUNT = 3;

let isSubscribed = !!localStorage.getItem('vip-pass');

function stylesToString(styles = {}) {
    return Object.entries(styles)
        .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value};`)
        .join(' ');
}

// ✨ [v3.1 변경] 이 함수는 이제 서버에서 모든 데이터를 가져왔으므로 필요 없어졌습니다.
// async function fetchContentDetails(ids) { ... } // <- 삭제!

function launchStoryViewer(pageContent) {
    const viewer = document.querySelector('.story-viewer');
    const container = viewer.querySelector('.story-container');
    const progressBarsContainer = viewer.querySelector('.story-progress-bars');
    const swiperWrapper = document.createElement('div');
    swiperWrapper.className = 'swiper-wrapper';

    swiperWrapper.innerHTML = pageContent.components.map(scene => {
        const settings = scene.sceneSettings || {};
        const sceneStyle = `background-color: ${settings.bgColor || '#000'}; background-image: url('${settings.bgImage || ''}');`;
        const innerComponentsHtml = (scene.components || []).map(component => {
            const componentStyle = stylesToString(component.styles);
            switch (component.type) {
                case 'heading': return `<h1 class="page-component" style="${componentStyle}">${component.content}</h1>`;
                case 'paragraph': return `<p class="page-component" style="${componentStyle}">${component.content}</p>`;
                case 'button': return `<a href="${component.link || '#'}" class="page-button page-component" style="${componentStyle}" target="_blank" rel="noopener noreferrer">${component.content}</a>`;
                default: return '';
            }
        }).join('');
        return `<div class="swiper-slide" style="${sceneStyle}">${innerComponentsHtml}</div>`;
    }).join('');

    progressBarsContainer.innerHTML = pageContent.components.map(() => ` <div class="progress-bar-container"><div class="progress-bar-fill"></div></div>`).join('');
    const oldSwiperWrapper = container.querySelector('.swiper-wrapper');
    if(oldSwiperWrapper) oldSwiperWrapper.remove();
    container.prepend(swiperWrapper);
    if (swiperInstance) swiperInstance.destroy(true, true);
    swiperInstance = new Swiper(container, {
        navigation: {
            nextEl: '.story-nav.next',
            prevEl: '.story-nav.prev',
        },
    });
    setupStoryPlayback(swiperInstance, progressBarsContainer);
    viewer.classList.add('is-active');
}

function setupStoryPlayback(swiper, progressBars) {
    const slidesCount = swiper.slides.length;
    const progressFills = progressBars.querySelectorAll('.progress-bar-fill');
    const DURATION = 5000;
    const playSlide = (index) => {
        if (storyTimer) clearTimeout(storyTimer);
        for (let i = 0; i < index; i++) {
            if (progressFills[i]) {
                progressFills[i].style.transition = 'none';
                progressFills[i].style.width = '100%';
            }
        }
        if (progressFills[index]) {
            progressFills[index].style.transition = 'none';
            progressFills[index].style.width = '0%';
            setTimeout(() => {
                progressFills[index].style.transition = `width ${DURATION}ms linear`;
                progressFills[index].style.width = '100%';
            }, 50);
        }
        storyTimer = setTimeout(() => {
            if (index < slidesCount - 1) {
                swiper.slideNext();
            } else {
                closeStoryViewer();
            }
        }, DURATION);
    };
    swiper.on('slideChange', () => playSlide(swiper.activeIndex));
    playSlide(0);
}

function closeStoryViewer() {
    const viewer = document.querySelector('.story-viewer');
    if (storyTimer) clearTimeout(storyTimer);
    if (swiperInstance) swiperInstance.destroy(true, true);
    swiperInstance = null;
    viewer.classList.remove('is-active');
}

function renderAllContent(contents, append = false) {
    const container = document.getElementById('content-container');
    if (!container) { console.error("Content container not found!"); return; }

    if (!append) {
        container.innerHTML = '';
    }

    const contentHtml = contents.map(content => {
        let cardHtml = ''; // 각 카드의 HTML을 임시 저장할 변수

        // --- 1. 먼저 모든 종류의 카드 HTML을 생성합니다. ---
        if (content.adType === 'subscription-form') {
            if (isSubscribed) {
                cardHtml = `<div class="card subscription-card"><h2 style="font-size: 22px; font-weight: bold; color: #f9fafb; margin-bottom: 8px;">이미 구독 중입니다!</h2><p style="color: #9ca3af; margin-bottom: 0;">최신 소식을 빠짐없이 보내드릴게요. ✨</p></div>`;
            } else {
                cardHtml = `<div class="card subscription-card"><h2>${content.title}</h2><p>${content.description}</p><form class="subscription-form"><input type="email" placeholder="이메일 주소를 입력하세요" required><button type="submit">구독하기</button></form></div>`;
            }
        } else if (content.components && content.components.some(c => c.type === 'scene')) {
            const firstScene = content.components[0] || {};
            const sceneSettings = firstScene.sceneSettings || {};
            const bgHtml = `<div class="story-launcher-bg" style="background-image: url('${sceneSettings.bgImage || ''}');"></div>`;
            cardHtml = `<div class="page-section story-launcher" style="background-color: ${sceneSettings.bgColor || '#000'}; cursor: pointer;" data-story-page-id="${content.id}" data-observe-target>${bgHtml}<div class="page-content-wrapper"><h1 class="page-component" style="color:white; font-size: 2rem;">${content.name}</h1><p style="color: white; opacity: 0.8;">클릭하여 스토리 보기</p></div></div>`;
        } else if (content.adType) {
            const contentType = 'card';
            const commonAttributes = `data-observe-target data-id="${content.id}" data-type="${contentType}"`;
            let mediaHtml = '';
            if (content.mediaUrl) {
                if (content.mediaType === 'video') {
                    mediaHtml = `<div class="card-media-wrapper"><video src="${content.mediaUrl}" autoplay loop muted playsinline></video></div>`;
                } else {
                    mediaHtml = `<div class="card-media-wrapper"><img src="${content.mediaUrl}" loading="lazy" alt="${content.title || '카드 이미지'}"></div>`;
                }
            }
            const partnersText = content.isPartners ? `<p class="partners-text">이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>` : '';
            const cardInnerHtml = `<div class="card" ${commonAttributes}>${mediaHtml}<div class="card-content"><h2>${content.title || '제목 없음'}</h2><p>${content.description || ' '}</p>${partnersText}</div></div>`;
            if (content.link) {
                cardHtml = `<a href="${content.link}" target="_blank" rel="noopener noreferrer" class="card-link">${cardInnerHtml}</a>`;
            } else {
                cardHtml = cardInnerHtml;
            }
        } else {
            // ... (페이지 섹션 렌더링 로직은 기존과 동일)
            const contentType = 'page';
            const commonAttributes = `data-observe-target data-id="${content.id}" data-type="${contentType}"`;
            const pageSettings = content.pageSettings || {};
            let pageStyle = `background-color: ${pageSettings.bgColor || 'transparent'};`;
            if (pageSettings.viewport) {
                const [widthStr, heightStr] = pageSettings.viewport.split(',');
                const width = parseFloat(widthStr);
                const height = parseFloat(heightStr);
                if (height > 0) { pageStyle += ` aspect-ratio: ${width} / ${height};`; }
            }
            const bgMediaHtml = pageSettings.bgVideo ? `<video class="page-background-video" src="${pageSettings.bgVideo}" autoplay loop muted playsinline></video>` : pageSettings.bgImage ? `<div class="page-background-image" style="background-image: url('${pageSettings.bgImage}');"></div>` : '';
            const componentsHtml = (content.components || []).map(component => {
                const componentStyle = stylesToString(component.styles);
                switch (component.type) {
                    case 'heading': return `<h1 class="page-component" style="${componentStyle}">${component.content}</h1>`;
                    case 'paragraph': return `<p class="page-component" style="${componentStyle}">${component.content}</p>`;
                    case 'button': return `<a href="${component.link || '#'}" class="page-button page-component" style="${componentStyle}" target="_blank" rel="noopener noreferrer">${component.content}</a>`;
                    default: return '';
                }
            }).join('');
            cardHtml = `<div class="page-section" ${commonAttributes} style="${pageStyle}">${bgMediaHtml}<div class="page-content-wrapper">${componentsHtml}</div></div>`;
        }

        // --- 2. ✨ [핵심] 생성된 HTML에 잠금 효과를 적용할지 결정합니다. ---
        if (content.isMembersOnly && !isSubscribed) {
            // 멤버 전용 콘텐츠인데 구독하지 않았다면, 블러 효과와 오버레이로 감쌉니다.
            return `
                <div class="locked-content-wrapper">
                    <div class="is-blurred">${cardHtml}</div>
                    <div class="locked-overlay">
                        <h3>✨ 구독자 전용 콘텐츠</h3>
                        <p>구독하고 바로 확인해보세요!</p>
                        <button class="subscribe-button-overlay">구독하기</button>
                    </div>
                </div>
            `;
        }
        
        // 잠글 필요가 없다면 원래 HTML을 그대로 반환합니다.
        return cardHtml;

    }).join('');

    if (append) {
        container.insertAdjacentHTML('beforeend', contentHtml);
    } else {
        container.innerHTML = contentHtml;
    }

    setupIntersectionObserver();
    // 3D Tilt 효과는 잠금 화면과 충돌할 수 있으므로, 원하시면 다시 추가하거나 그대로 두세요.
    // setupTiltEffect();
}

// ✨ [v3.1 변경] 더 이상 서버에 요청하지 않고, 미리 받아온 전체 데이터에서 다음 부분을 잘라 씁니다.
function loadMoreContent() {
    if (loadedContentIndex >= allContent.length) {
        console.log("All content loaded.");
        return;
    }
    const nextContentsToRender = allContent.slice(loadedContentIndex, loadedContentIndex + INITIAL_LOAD_COUNT);
    renderAllContent(nextContentsToRender, true);
    loadedContentIndex += INITIAL_LOAD_COUNT;
}

function handleParallaxScroll() {
    const parallaxElements = document.querySelectorAll('.story-launcher-bg');
    const windowHeight = window.innerHeight;
    parallaxElements.forEach(el => {
        const rect = el.parentElement.getBoundingClientRect();
        if (rect.top < windowHeight && rect.bottom > 0) {
            const elementCenter = rect.top + rect.height / 2;
            const screenCenter = windowHeight / 2;
            const distance = screenCenter - elementCenter;
            const intensity = 0.1;
            const yOffset = distance * intensity;
            el.style.transform = `translateY(${yOffset}px)`;
        }
    });
}

async function track(contentId, contentType, fieldToIncrement) {
    if (!contentId || !contentType || !fieldToIncrement) return;
    const collectionName = contentType === 'page' ? 'pages' : 'ads';
    try {
        await firebaseReady; // 트래킹을 위해 Firebase 연결은 여전히 필요합니다.
        const db = getFirestoreDB();
        const contentRef = doc(db, collectionName, contentId);
        await updateDoc(contentRef, {
            [fieldToIncrement]: increment(1)
        });
        console.log(`${fieldToIncrement} tracked for ${contentType}: ${contentId}`);
    } catch (error) {
        if (error.code !== 'not-found') {
            console.error(`Error tracking ${fieldToIncrement} for ${contentType}:`, error);
        }
    }
}

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
            if (currentActive) {
                currentActive.classList.remove('is-visible');
            }
            mostVisibleElement.classList.add('is-visible');
            currentActive = mostVisibleElement;
        }
    };
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                visibleElements.set(entry.target, entry);
                const { id, type } = entry.target.dataset;
                if (id && !trackedImpressions.has(id)) {
                    track(id, type, 'viewCount');
                    trackedImpressions.add(id);
                }
            } else {
                visibleElements.delete(entry.target);
                if (entry.target === currentActive) {
                    currentActive.classList.remove('is-visible');
                    currentActive = null;
                }
            }
        });
        updateActive();
    }, {
        threshold: Array.from({
            length: 101
        }, (_, i) => i / 100)
    });
    const targets = document.querySelectorAll('[data-observe-target]');
    targets.forEach(target => observer.observe(target));
}

// ✨ [v3.3 핵심 변경] VIP 패스가 있으면 요청 헤더에 담아 보내도록 수정
async function renderPublicPage() {
    const container = document.getElementById('content-container');
    console.log("🚀 Public page v3.3 script loaded. Fetching from Netlify Function...");

    // 1. 주머니(localStorage)에서 VIP 패스를 꺼냅니다.
    const token = localStorage.getItem('vip-pass');

    // 2. 요청에 포함할 헤더를 준비합니다.
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        // 3. VIP 패스가 있으면, 'Authorization'란에 붙여서 보냅니다.
        headers['Authorization'] = `Bearer ${token}`;
        console.log('VIP 패스를 장착하고 요청합니다.');
    }

    try {
        // 4. 헤더를 포함하여 경비원에게 콘텐츠를 요청합니다.
        const response = await fetch('/.netlify/functions/get-content', { headers });
        if (!response.ok) {
            throw new Error(`콘텐츠 로딩 실패! (상태: ${response.status})`);
        }
        allContent = await response.json();
        console.log("🎉 Total content received:", allContent.length);

        const initialContents = allContent.slice(0, INITIAL_LOAD_COUNT);
        renderAllContent(initialContents);
        loadedContentIndex = INITIAL_LOAD_COUNT;
        
        if (allContent.length > INITIAL_LOAD_COUNT) {
            setupLoadMoreTrigger();
        }
    } catch (error) {
        console.error("🔥 An error occurred:", error);
        if (container) {
            container.innerHTML = `<p class="text-center text-red-500">페이지를 불러오는 중 오류가 발생했습니다.</p>`;
        }
    }
}

function setupLoadMoreTrigger() {
    const existingTrigger = document.getElementById('load-more-trigger');
    if (existingTrigger) existingTrigger.remove();

    const trigger = document.createElement('div');
    trigger.id = 'load-more-trigger';
    document.getElementById('content-container').appendChild(trigger);

    const observer = new IntersectionObserver(async (entries) => {
        if (entries[0].isIntersecting) {
            loadMoreContent(); // 이제 이 함수는 네트워크 요청을 하지 않습니다.
            if (loadedContentIndex >= allContent.length) {
                observer.unobserve(trigger);
                trigger.remove();
            }
        }
    }, { threshold: 1.0 });

    observer.observe(trigger);
}

document.addEventListener('click', async (event) => {
    const storyLauncher = event.target.closest('.story-launcher');
    if (storyLauncher) {
        const pageId = storyLauncher.dataset.storyPageId;
        const pageData = allContent.find(p => p.id === pageId);
        if(pageData) {
            launchStoryViewer(pageData);
        }
        return;
    }
    const trackableElement = event.target.closest('[data-id][data-type]');
    if (trackableElement) {
        const { id, type } = trackableElement.dataset;
        track(id, type, 'clickCount');
    }
});

// js/public.js v3.8 - 구독 성공 시 로드된 모든 콘텐츠를 즉시 다시 렌더링
document.addEventListener('submit', async (event) => {
    if (event.target.classList.contains('subscription-form')) {
        event.preventDefault();
        const form = event.target;
        const input = form.querySelector('input[type="email"]');
        const button = form.querySelector('button');
        const email = input.value;

        button.disabled = true;
        button.textContent = '처리 중...';

        try {
            const response = await fetch('/.netlify/functions/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email }),
            });
            const result = await response.json();
            
            if (!response.ok || !result.success) {
                throw new Error(result.message || '오류가 발생했습니다.');
            }
            
            showToast(result.message, 'success');
            
            if (result.token) {
                localStorage.setItem('vip-pass', result.token);
                isSubscribed = true;
            }
            
            // ✨ [핵심 해결책] 
            // 1. 서버에서 모든 콘텐츠가 포함된 최신 목록을 다시 가져옵니다.
            await renderPublicPage(); 
            
            // 2. '무한 스크롤'을 무시하고, 현재까지 로드된 모든 콘텐츠를
            //    새로운 데이터로 즉시 다시 렌더링합니다.
            const currentlyLoadedContent = allContent.slice(0, loadedContentIndex);
            renderAllContent(currentlyLoadedContent);

        } catch (error) {
            showToast(error.message, 'error');
            button.disabled = false;
            button.textContent = '구독하기';
        }
    }
});

const storyCloseButton = document.querySelector('.story-viewer .story-close-button');
if (storyCloseButton) storyCloseButton.addEventListener('click', closeStoryViewer);

renderPublicPage();
window.addEventListener('scroll', handleParallaxScroll);