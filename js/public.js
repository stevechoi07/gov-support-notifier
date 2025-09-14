// js/public.js v2.8 - 이미지 지연 로딩(Lazy Loading) 적용

import { doc, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { firebaseReady, getFirestoreDB } from './firebase.js';

let swiperInstance = null;
let storyTimer = null;

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

function renderAllContent(contents) {
    const container = document.getElementById('content-container');
    if (!container) { console.error("Content container not found!"); return; }
    if (contents.length === 0) { container.innerHTML = `<p class="text-center text-gray-500">표시할 콘텐츠가 없습니다.</p>`; return; }

    const contentHtml = contents.map(content => {
        const isStory = content.components && content.components.some(c => c.type === 'scene');
        if (isStory) {
            const firstScene = content.components[0] || {};
            const sceneSettings = firstScene.sceneSettings || {};
            const bgHtml = `<div class="story-launcher-bg" style="background-image: url('${sceneSettings.bgImage || ''}');"></div>`;
            return ` <div class="page-section story-launcher" style="background-color: ${sceneSettings.bgColor || '#000'}; cursor: pointer;" data-story-page-id="${content.id}" data-observe-target> ${bgHtml} <div class="page-content-wrapper"> <h1 class="page-component" style="color:white; font-size: 2rem;">${content.name}</h1> <p style="color: white; opacity: 0.8;">클릭하여 스토리 보기</p> </div> </div> `;
        } else if (content.adType) {
            const contentType = 'card';
            const commonAttributes = `data-observe-target data-id="${content.id}" data-type="${contentType}"`;
            let mediaHtml = '';
            if (content.mediaUrl) {
                if (content.mediaType === 'video') {
                    mediaHtml = `<div class="card-media-wrapper"><video src="${content.mediaUrl}" autoplay loop muted playsinline></video></div>`;
                } else {
                    // ✨ [핵심 수정] img 태그에 loading="lazy" 속성을 추가합니다.
                    mediaHtml = `<div class="card-media-wrapper"><img src="${content.mediaUrl}" loading="lazy" alt="${content.title || '카드 이미지'}"></div>`;
                }
            }
            const partnersText = content.isPartners ? `<p class="partners-text">이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>` : '';
            const cardInnerHtml = `<div class="card" ${commonAttributes}>${mediaHtml}<div class="card-content"><h2>${content.title || '제목 없음'}</h2><p>${content.description || ' '}</p>${partnersText}</div></div>`;
            if (content.link) {
                return `<a href="${content.link}" target="_blank" rel="noopener noreferrer" class="card-link">${cardInnerHtml}</a>`;
            } else {
                return cardInnerHtml;
            }
        } else {
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
            return `<div class="page-section" ${commonAttributes} style="${pageStyle}">${bgMediaHtml}<div class="page-content-wrapper">${componentsHtml}</div></div>`;
        }
    }).join('');

    container.innerHTML = contentHtml;
    setupIntersectionObserver();
    setupTiltEffect();
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
                const {
                    id,
                    type
                } = entry.target.dataset;
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

function setupTiltEffect() {
    const tiltElements = document.querySelectorAll('.card, .page-section');
    const MAX_ROTATION = 8;

    tiltElements.forEach(el => {
        el.addEventListener('mousemove', (e) => {
            const rect = el.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const {
                width,
                height
            } = rect;
            const rotateX = MAX_ROTATION * ((y / height) - 0.5) * -2;
            const rotateY = MAX_ROTATION * ((x / width) - 0.5) * 2;
            el.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
        });
        el.addEventListener('mouseleave', () => {
            el.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
        });
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
            if (container) container.innerHTML = `<p class="text-center text-red-500">레이아웃 정보를 찾을 수 없습니다.</p>`;
        }
    } catch (error) {
        console.error("🔥 An error occurred:", error);
        if (container) container.innerHTML = `<p class="text-center text-red-500">페이지를 불러오는 중 오류가 발생했습니다.</p>`;
    }
}

document.addEventListener('click', async (event) => {
    const storyLauncher = event.target.closest('.story-launcher');
    if (storyLauncher) {
        const pageId = storyLauncher.dataset.storyPageId;
        const db = getFirestoreDB();
        const docRef = doc(db, 'pages', pageId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            launchStoryViewer({
                id: docSnap.id,
                ...docSnap.data()
            });
        }
        return;
    }
    const trackableElement = event.target.closest('[data-id][data-type]');
    if (trackableElement) {
        const {
            id,
            type
        } = trackableElement.dataset;
        track(id, type, 'clickCount');
    }
});

const storyCloseButton = document.querySelector('.story-viewer .story-close-button');
if (storyCloseButton) storyCloseButton.addEventListener('click', closeStoryViewer);

renderPublicPage();
window.addEventListener('scroll', handleParallaxScroll);