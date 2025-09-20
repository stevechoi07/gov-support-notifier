// js/public.js (v7.3 - 고객 정보 블록 렌더링 및 제출 기능 추가)

import { doc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { firebaseReady, getFirestoreDB } from './firebase.js';
import { showToast } from './ui.js';

let swiperInstance = null;
let storyTimer = null;
let allContent = [];
let loadedContentIndex = 0;
const INITIAL_LOAD_COUNT = 3;

let isSubscribed = !!localStorage.getItem('vip-pass');

// ✨ editor.js와 동일한 필드 목록을 추가하여 폼을 정확하게 렌더링합니다.
const allPossibleFormFields = [ 
    { name: 'name', label: '이름', type: 'text', placeholder: '이름을 입력하세요' }, 
    { name: 'email', label: '이메일', type: 'email', placeholder: '이메일 주소를 입력하세요' }, 
    { name: 'phone', label: '전화번호', type: 'tel', placeholder: '전화번호를 입력하세요' }, 
    { name: 'birthdate', label: '생년월일', type: 'date', placeholder: '' }, 
    { name: 'gender', label: '성별', type: 'text', placeholder: '성별을 입력하세요' } 
];

function stylesToString(styles = {}) {
    return Object.entries(styles)
        .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value};`)
        .join(' ');
}

function assignMediaCardIndices(contentList) {
    let mediaCardCounter = 0;
    return contentList.map(content => {
        const isTrueMediaCard = content.adType && content.adType !== 'subscription-form' && content.adType !== 'iframe';
        if (isTrueMediaCard) {
            content.mediaCardIndex = mediaCardCounter;
            mediaCardCounter++;
        }
        return content;
    });
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

function renderAllContent(contents, append = false, startIndex = 0) { 
    const container = document.getElementById('content-container');
    if (!container) { console.error("Content container not found!"); return; }

    if (!append) {
        container.innerHTML = '';
    }

    const contentHtml = contents.map((content, index) => {
        let cardHtml = '';
        let layoutClass = ''; 

        if (!content.adType && !(content.components && content.components.some(c => c.type === 'scene'))) {
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
                let elementHtml = '';
                switch (component.type) {
                    case 'heading': 
                        elementHtml = `<h1 class="page-component" style="${componentStyle}">${component.content}</h1>`;
                        break;
                    case 'paragraph': 
                        elementHtml = `<p class="page-component" style="${componentStyle}">${component.content}</p>`;
                        break;
                    case 'button': 
                        elementHtml = `<a href="${component.link || '#'}" class="page-button page-component" style="${componentStyle}" target="_blank" rel="noopener noreferrer">${component.content}</a>`;
                        break;
                    case 'lead-form':
                        const formStyles = component.styles || {};
                        let formFieldsHtml = (allPossibleFormFields.filter(field => component.activeFields?.includes(field.name)) || []).map(field => `
                            <div class="lead-form-group">
                                <input type="${field.type}" name="${field.name}" placeholder="${field.placeholder}" required class="lead-form-input">
                            </div>
                        `).join('');

                        if (component.privacy?.enabled) {
                            formFieldsHtml += `
                                <div class="lead-form-privacy">
                                    <input type="checkbox" id="privacy-${component.id}" required>
                                    <label for="privacy-${component.id}">${component.privacy.text}</label>
                                </div>`;
                        }
                        
                        elementHtml = `
                            <form class="lead-form" style="${componentStyle}" data-script-url="${component.googleScriptUrl || ''}" data-success-message="${component.successMessage || '제출되었습니다.'}">
                                ${formFieldsHtml}
                                <button type="submit" class="lead-form-submit" style="background-color: ${formStyles.submitButtonColor || '#1877f2'};">${component.submitText || '제출'}</button>
                            </form>`;
                        break;
                    default: 
                        elementHtml = '';
                }
                const wrapperStyle = (component.styles?.verticalAlign === 'bottom') ? 'margin-top: auto;' : '';
                return `<div class="component-wrapper" style="${wrapperStyle}">${elementHtml}</div>`;
            }).join('');

            cardHtml = `<div class="page-section" ${commonAttributes} style="${pageStyle}">${bgMediaHtml}<div class="page-content-wrapper">${componentsHtml}</div></div>`;

        } else {
            if (content.adType === 'subscription-form' || (content.components && content.components.some(c => c.type === 'scene')) || content.adType === 'iframe') {
                layoutClass = 'layout-default';
            } 
            else if (typeof content.mediaCardIndex !== 'undefined') {
                if (content.mediaCardIndex === 0) {
                    layoutClass = 'layout-hero';
                } else if (content.mediaCardIndex === 1 || content.mediaCardIndex === 2) {
                    layoutClass = 'layout-medium';
                } else {
                    layoutClass = 'layout-default';
                }
            } else {
                layoutClass = 'layout-default';
            }

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
            } else if (content.adType === 'iframe' && content.iframeSrc) {
                const contentType = 'card';
                const commonAttributes = `data-observe-target data-id="${content.id}" data-type="${contentType}"`;
                cardHtml = `
                    <div class="card ad-card" ${commonAttributes}>
                        <div class="iframe-container" style="aspect-ratio: 16 / 9; width: 100%;">
                            <iframe src="${content.iframeSrc}"
                                    style="width: 100%; height: 100%; border: none;"
                                    title="${content.title || 'Advertisement'}">
                            </iframe>
                        </div>
                    </div>`;
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
        
        if (content.isMembersOnly && !isSubscribed) {
            return `<div class="locked-content-wrapper ${layoutClass}">${finalHtml}</div>`;
        }
        return `<div class="${layoutClass}">${finalHtml}</div>`;

    }).join('');

    const containerToAppend = document.getElementById('content-container');
    if (append) {
        containerToAppend.insertAdjacentHTML('beforeend', contentHtml);
    } else {
        containerToAppend.innerHTML = contentHtml;
    }

    setupIntersectionObserver();
}

function loadMoreContent() {
    if (loadedContentIndex >= allContent.length) {
        console.log("All content loaded.");
        return;
    }
    
    const nextContentsToRender = allContent.slice(loadedContentIndex, loadedContentIndex + INITIAL_LOAD_COUNT);
    
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
    const loadingIndicator = document.getElementById('loading-indicator');
    const loadingProgress = document.getElementById('loading-progress');
    
    if (loadingIndicator) loadingIndicator.style.display = 'flex';
    
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += 1;
        if (progress <= 100) {
            if (loadingProgress) loadingProgress.textContent = `${progress}%`;
        } else {
            clearInterval(progressInterval);
        }
    }, 20);

    console.log("🚀 Public page script loaded. Fetching all content...");

    try {
        const response = await fetch('/.netlify/functions/get-content');
        if (!response.ok) {
            throw new Error(`콘텐츠 로딩 실패! (상태: ${response.status})`);
        }
        allContent = await response.json();
        console.log("🎉 Total content received:", allContent.length);

        allContent = assignMediaCardIndices(allContent);

        clearInterval(progressInterval);
        if (loadingIndicator) loadingIndicator.style.display = 'none';

        const initialContents = allContent.slice(0, INITIAL_LOAD_COUNT);
        renderAllContent(initialContents);
        loadedContentIndex = INITIAL_LOAD_COUNT;
        
        if (allContent.length > INITIAL_LOAD_COUNT) {
            setupLoadMoreTrigger();
        }
    } catch (error) {
        console.error("🔥 An error occurred:", error);
        clearInterval(progressInterval);
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        
        if (container) {
            container.innerHTML = `<p style="color: white; text-align: center;">페이지를 불러오는 중 오류가 발생했습니다.</p>`;
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

function handleAdClick(adId) {
    track(adId, 'card', 'clickCount');
}

document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('message', (event) => {
        if (event.data === 'iframe-ad-clicked') {
            console.log('메인 페이지: iframe으로부터 클릭 신호 수신!');
            const iframes = document.querySelectorAll('iframe');
            let clickedAdId = null;
            for (const iframe of iframes) {
                if (iframe.contentWindow === event.source) {
                    const adCard = iframe.closest('.ad-card[data-id]');
                    if (adCard) {
                        clickedAdId = adCard.dataset.id;
                        break;
                    }
                }
            }
            if (clickedAdId) {
                handleAdClick(clickedAdId);
            } else {
                console.warn('클릭된 iframe의 광고 ID를 찾을 수 없습니다.');
            }
        }
    });
});


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

    const overlayButton = event.target.closest('.subscribe-button-overlay');
    if (overlayButton) {
        const subscriptionForm = document.getElementById('subscription-form-card');
        if (subscriptionForm) {
            subscriptionForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }
    
    const trackableElement = event.target.closest('a.card-link [data-id][data-type]');
    if (trackableElement) {
        const { id, type } = trackableElement.dataset;
        track(id, type, 'clickCount');
    }
});

// ✨ [핵심 수정] 폼 제출 이벤트 리스너를 확장하여 lead-form도 처리하도록 함
document.addEventListener('submit', async (event) => {
    const form = event.target;
    // 뉴스레터 구독 폼 처리
    if (form.classList.contains('subscription-form')) {
        event.preventDefault();
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
            
            // 콘텐츠 새로고침
            const contentResponse = await fetch('/.netlify/functions/get-content');
            allContent = await contentResponse.json();
            allContent = assignMediaCardIndices(allContent);
            renderAllContent(allContent, false);
            loadedContentIndex = allContent.length;
            const trigger = document.getElementById('load-more-trigger');
            if (trigger) trigger.remove();

        } catch (error) {
            showToast(error.message, 'error');
            button.disabled = false;
            button.textContent = '구독하기';
        }
    } 
    // 고객 정보(lead) 폼 처리
    else if (form.classList.contains('lead-form')) {
        event.preventDefault();
        const scriptUrl = form.dataset.scriptUrl;
        const successMessage = form.dataset.successMessage;
        if (!scriptUrl) {
            showToast('폼 제출 URL이 설정되지 않았습니다.', 'error');
            return;
        }

        const button = form.querySelector('button[type="submit"]');
        const originalButtonText = button.textContent;
        button.disabled = true;
        button.textContent = '전송 중...';

        try {
            const formData = new FormData(form);
            const response = await fetch(scriptUrl, {
                method: 'POST',
                body: formData,
                mode: 'no-cors' // Google Script 웹 앱은 보통 no-cors 모드가 필요
            });
            
            // no-cors 모드에서는 응답을 직접 확인할 수 없으므로, 요청이 보내진 것으로 간주하고 성공 처리
            showToast(successMessage, 'success');
            form.reset();

        } catch (error) {
            console.error('Lead form submission error:', error);
            showToast('제출 중 오류가 발생했습니다.', 'error');
        } finally {
            button.disabled = false;
            button.textContent = originalButtonText;
        }
    }
});

const storyCloseButton = document.querySelector('.story-viewer .story-close-button');
if (storyCloseButton) storyCloseButton.addEventListener('click', closeStoryViewer);

renderPublicPage();
window.addEventListener('scroll', handleParallaxScroll);