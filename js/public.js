// js/public.js v5.0 - 동적 레이아웃 렌더링 함수 구조 수정

import { doc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { firebaseReady, getFirestoreDB } from './firebase.js';
import { showToast } from './ui.js';

let swiperInstance = null;
let storyTimer = null;
let allContent = [];
let loadedContentIndex = 0;
const INITIAL_LOAD_COUNT = 3;

let isSubscribed = !!localStorage.getItem('vip-pass');

function stylesToString(styles = {}) {
    return Object.entries(styles)
        .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value};`)
        .join(' ');
}

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

// ✨ 함수의 인자로 startIndex 를 추가합니다. 기본값은 0입니다.
function renderAllContent(contents, append = false, startIndex = 0) { 
    const container = document.getElementById('content-container');
    if (!container) { console.error("Content container not found!"); return; }

    if (!append) {
        container.innerHTML = '';
    }

    const contentHtml = contents.map((content, index) => {
        const absoluteIndex = startIndex + index;
        let cardHtml = '';
        let layoutClass = ''; 

        // [구조 수정] '페이지' 타입과 '미디어 카드' 타입을 명확하게 분리하여 처리합니다.
        if (!content.adType && !(content.components && content.components.some(c => c.type === 'scene'))) {
            // ✨ 1. '페이지' 타입 콘텐츠 처리
            layoutClass = 'layout-full';
            
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

        } else {
            // ✨ 2. '미디어 카드' (광고, 스토리 런처, 구독 폼 등) 타입 처리
            if (absoluteIndex === 0) {
                layoutClass = 'layout-hero';
            } else if (absoluteIndex === 1 || absoluteIndex === 2) {
                layoutClass = 'layout-medium';
            } else {
                layoutClass = 'layout-default';
            }

            // 미디어 카드, 구독 폼, 스토리 런처 등을 그리는 로직
            if (content.adType === 'subscription-form') {
                if (isSubscribed) {
                    cardHtml = `<div class="card subscription-card"><h2 style="font-size: 22px; font-weight: bold; color: #f9fafb; margin-bottom: 8px;">이미 구독 중입니다!</h2><p style="color: #9ca3af; margin-bottom: 0;">최신 소식을 빠짐없이 보내드릴게요. ✨</p></div>`;
                } else {
                    cardHtml = `<div class="card subscription-card" id="subscription-form-card"><h2>${content.title}</h2><p>${content.description}</p><form class="subscription-form"><input type="email" placeholder="이메일 주소를 입력하세요" required><button type="submit">구독하기</button></form></div>`;
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
            }
        }
        
        // ✨ 3. 멤버 전용 콘텐츠인지 확인하고 최종 HTML을 결정합니다.
        let finalHtml = cardHtml;
        if (content.isMembersOnly && !isSubscribed) {
            finalHtml = `
                <div class="is-blurred">${cardHtml}</div>
                <div class="locked-overlay">
                    <h3>✨ 구독자 전용 콘텐츠</h3>
                    <p>구독하고 바로 확인해보세요!</p>
                    <button class="subscribe-button-overlay">구독하기</button>
                </div>
            `;
        }
        
        // ✨ 4. 최종 HTML을 레이아웃 div로 감싸서 반환합니다.
        if (content.isMembersOnly && !isSubscribed) {
            return `<div class="locked-content-wrapper ${layoutClass}">${finalHtml}</div>`;
        }
        return `<div class="${layoutClass}">${finalHtml}</div>`;

    }).join('');

    if (append) {
        container.insertAdjacentHTML('beforeend', contentHtml);
    } else {
        container.innerHTML = contentHtml;
    }

    setupIntersectionObserver();
}

// ✨ `loadMoreContent` 함수도 `startIndex`를 전달하도록 수정이 필요합니다.
function loadMoreContent() {
    if (loadedContentIndex >= allContent.length) {
        console.log("All content loaded.");
        return;
    }
    const nextContentsToRender = allContent.slice(loadedContentIndex, loadedContentIndex + INITIAL__LOAD_COUNT);
    // ✨ renderAllContent를 호출할 때, 현재 로드된 콘텐츠의 인덱스(loadedContentIndex)를 startIndex로 넘겨줍니다.
    renderAllContent(nextContentsToRender, true, loadedContentIndex);
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
        await firebaseReady;
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

async function renderPublicPage() {
    const container = document.getElementById('content-container');
    console.log("🚀 Public page v4.0 script loaded. Fetching all content...");

    try {
        const response = await fetch('/.netlify/functions/get-content');
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
            loadMoreContent();
            if (loadedContentIndex >= allContent.length) {
                observer.unobserve(trigger);
                trigger.remove();
            }
        }
    }, { threshold: 1.0 });

    observer.observe(trigger);
}

document.addEventListener('click', async (event) => {
    // 1. 스토리 실행 버튼인지 확인
    const storyLauncher = event.target.closest('.story-launcher');
    if (storyLauncher) {
        const pageId = storyLauncher.dataset.storyPageId;
        const pageData = allContent.find(p => p.id === pageId);
        if(pageData) {
            launchStoryViewer(pageData);
        }
        return;
    }

    // 2. ✨ [v4.0 변경] 블러 오버레이의 '구독하기' 버튼인지 확인
    const overlayButton = event.target.closest('.subscribe-button-overlay');
    if (overlayButton) {
        const subscriptionForm = document.getElementById('subscription-form-card');
        if (subscriptionForm) {
            // 구독 폼 위치로 부드럽게 스크롤합니다.
            subscriptionForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return; // 다른 클릭 이벤트는 무시
    }

    // 3. 클릭 수 추적 대상인지 확인
    const trackableElement = event.target.closest('[data-id][data-type]');
    if (trackableElement) {
        const { id, type } = trackableElement.dataset;
        track(id, type, 'clickCount');
    }
});

// js/public.js v4.1 - 구독 성공 시 실시간 잠금 해제 로직 최종 수정
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
            const contentResponse = await fetch('/.netlify/functions/get-content');
            allContent = await contentResponse.json(); // 전역 콘텐츠 목록을 업데이트합니다.

            // 2. 받아온 '전체 콘텐츠'를 한 번에 화면에 모두 그려줍니다.
            renderAllContent(allContent);

            // 3. 모든 콘텐츠가 로드되었으므로 '더 보기' 트리거는 제거합니다.
            loadedContentIndex = allContent.length;
            const trigger = document.getElementById('load-more-trigger');
            if (trigger) trigger.remove();

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