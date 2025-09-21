// js/layoutManager.js (v2.15 - iframe 카드 타입 구분 로직 추가)

import { doc, getDoc, updateDoc, arrayRemove, arrayUnion, onSnapshot, collection } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { showToast } from './ui.js';
import { pagesList, pagesReady } from './pages.js';
import { cards, cardsReady } from './cards.js';
import { firebaseReady, getFirestoreDB } from './firebase.js';
import { initHomeDashboard } from './home.js';

const layoutListContainer = document.getElementById('layout-list-container');
const modalElements = {};
let sortableInstance = null;
let currentLayoutIds = [];
let isInitialized = false;

async function listenToLayoutChanges(layoutId) { await firebaseReady; const db = getFirestoreDB(); if (!db) { console.error("Firestore DB가 초기화되지 않았습니다."); return; } const layoutRef = doc(db, "layouts", layoutId); onSnapshot(layoutRef, async (snapshot) => { if (!snapshot.exists() || !snapshot.data().contentIds) { currentLayoutIds = []; renderLayoutList([]); return; } const contentIds = snapshot.data().contentIds; currentLayoutIds = contentIds; const contents = await fetchContentsDetails(contentIds); renderLayoutList(contents); }); }
async function fetchContentsDetails(ids) { await firebaseReady; const db = getFirestoreDB(); if (ids.length === 0) return []; if (!db) return []; const contentPromises = ids.map(async (id) => { if (!id) return null; let contentRef = doc(db, 'pages', id); let contentSnap = await getDoc(contentRef); if (!contentSnap.exists()) { contentRef = doc(db, 'ads', id); contentSnap = await getDoc(contentRef); } return contentSnap.exists() ? { id: contentSnap.id, ...contentSnap.data() } : null; }); const contents = await Promise.all(contentPromises); return contents.filter(Boolean); }

function renderLayoutList(contents) {
    if (!layoutListContainer) return;
    layoutListContainer.className = 'grid gap-4';
    if (contents.length === 0) {
        layoutListContainer.innerHTML = `<div class="text-center py-10 rounded-lg bg-slate-800"><h3 class="text-lg font-semibold text-slate-400">레이아웃에 표시할 콘텐츠가 없습니다.</h3><p class="text-slate-500 mt-1">상단의 '콘텐츠 추가' 버튼을 눌러 페이지나 카드를 추가해보세요.</p></div>`;
        return;
    }
    const sortedContents = currentLayoutIds.map(id => contents.find(c => c.id === id)).filter(Boolean);
    
    layoutListContainer.innerHTML = sortedContents.map(content => {
        const isPage = !content.adType;
        const isStory = isPage && content.components?.some(c => c.type === 'scene');
        
        // ✨ [핵심 수정 v2.15] adType을 기준으로 iframe 카드와 일반 카드를 구분합니다.
        const isIframeCard = content.adType === 'iframe';
        const typeLabel = isStory ? '✨ 스토리' : (isPage ? '📄 페이지' : (isIframeCard ? '🌐 아이프레임' : '🗂️ 카드'));
        const typeColor = isStory ? 'bg-pink-500/20 text-pink-400' : (isPage ? 'bg-sky-500/20 text-sky-400' : (isIframeCard ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'));
        
        let previewImageUrl = null;
        if(isStory) {
            const firstScene = content.components.find(c => c.type === 'scene');
            previewImageUrl = firstScene?.sceneSettings?.bgImage;
        } else if (isPage) {
            previewImageUrl = content.pageSettings?.thumbnailUrl || content.pageSettings?.bgImage;
        } else { // card 또는 iframe
            previewImageUrl = content.thumbnailUrl || content.mediaUrl;
        }

        const previewBgColor = isPage ? (content.pageSettings?.bgColor || '#1e2d3b') : '#1e2d3b';
        const statsHtml = `<div class="flex items-center gap-4 text-xs text-slate-400 mt-2"><span class="flex items-center" title="노출 수"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>${(content.viewCount ?? 0).toLocaleString()}</span><span class="flex items-center" title="클릭 수"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1"><path d="M22 14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.7a2 2 0 0 1 1.4.6l5.8 5.8a2 2 0 0 1 .6 1.4V14Z"/><path d="m14 14-4-4"/><path d="M10 14h4v-4"/></svg>${(content.clickCount ?? 0).toLocaleString()}</span></div>`;
        
        return `
            <div class="layout-item flex items-center bg-slate-800 rounded-lg p-3 gap-4 shadow-sm" data-id="${content.id}">
                <div class="drag-handle cursor-move text-slate-600 hover:text-slate-400"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg></div>
                <div class="w-24 h-14 bg-cover bg-center rounded-md" style="background-color: ${previewBgColor}; ${previewImageUrl ? `background-image: url('${previewImageUrl}')` : ''}"></div>
                <div class="flex-1 overflow-hidden">
                    <div class="flex justify-between items-start">
                        <h4 class="font-bold text-slate-200 truncate" title="${content.title || content.name}">${content.title || content.name}</h4>
                        <span class="text-xs font-semibold px-2 py-1 rounded-full ${typeColor} flex-shrink-0">${typeLabel}</span>
                    </div>
                    ${statsHtml}
                </div>
                <button class="remove-btn text-slate-500 hover:text-red-500 transition-colors" title="레이아웃에서 제거"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
            </div>
        `;
    }).join('');

    attachEventListeners();
    initializeSortable();
}

function attachEventListeners() { document.querySelectorAll('.layout-item .remove-btn').forEach(button => { button.addEventListener('click', async (e) => { await firebaseReady; const db = getFirestoreDB(); if (!db) return; const item = e.currentTarget.closest('.layout-item'); const contentId = item.dataset.id; if (confirm(`'${item.querySelector('h4').textContent}' 콘텐츠를 레이아웃에서 제거하시겠습니까?`)) { const layoutRef = doc(db, "layouts", "mainLayout"); await updateDoc(layoutRef, { contentIds: arrayRemove(contentId) }); showToast('콘텐츠가 레이아웃에서 제거되었습니다.'); } }); }); }
function initializeSortable() { if (!layoutListContainer) return; if (sortableInstance) sortableInstance.destroy(); sortableInstance = new Sortable(layoutListContainer, { handle: '.drag-handle', animation: 150, ghostClass: 'sortable-ghost', onEnd: async (evt) => { await firebaseReady; const db = getFirestoreDB(); if (!db) return; const newOrder = Array.from(evt.to.children).map(item => item.dataset.id); const layoutRef = doc(db, "layouts", "mainLayout"); await updateDoc(layoutRef, { contentIds: newOrder }); showToast('레이아웃 순서가 저장되었습니다.', 'success'); }, }); }
function mapModalUI() { modalElements.modal = document.getElementById('add-content-modal'); modalElements.closeButton = document.getElementById('close-add-content-modal-button'); modalElements.finishButton = document.getElementById('finish-adding-content-button'); modalElements.tabs = document.querySelectorAll('#add-content-tabs .tab-button'); modalElements.tabContents = document.querySelectorAll('#add-content-modal .tab-content'); modalElements.pagesListContainer = document.getElementById('add-content-pages-list'); modalElements.cardsListContainer = document.getElementById('add-content-cards-list'); }
function setupModalListeners() { modalElements.closeButton?.addEventListener('click', () => modalElements.modal.classList.remove('active')); modalElements.finishButton?.addEventListener('click', () => modalElements.modal.classList.remove('active')); modalElements.tabs?.forEach(tab => { tab.addEventListener('click', () => switchTab(tab.dataset.tab)); }); modalElements.modal?.addEventListener('click', (e) => { if (e.target.classList.contains('add-button') && !e.target.disabled) { addItemToLayout(e.target.dataset.id); e.target.disabled = true; e.target.textContent = '추가됨'; } }); }
function switchTab(tabName) { modalElements.tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabName)); modalElements.tabContents.forEach(content => content.classList.toggle('active', content.id.includes(tabName))); }
async function addItemToLayout(contentId) { await firebaseReady; const db = getFirestoreDB(); if (!db) { showToast("데이터베이스 연결에 실패했습니다.", "error"); return; } try { const layoutRef = doc(db, "layouts", "mainLayout"); await updateDoc(layoutRef, { contentIds: arrayUnion(contentId) }); showToast('콘텐츠가 레이아웃에 추가되었습니다.'); } catch (error) { console.error("레이아웃에 아이템 추가 실패:", error); showToast("아이템 추가에 실패했습니다.", "error"); const button = document.querySelector(`.add-button[data-id="${contentId}"]`); if(button) { button.disabled = false; button.textContent = '추가'; } } }

export async function handleAddContentClick() {
    await Promise.all([pagesReady, cardsReady]);

    const getThumbnailHtml = (item, type) => {
        let thumbnailUrl = null;
        let mediaTypeIcon = '';

        if (type === 'page') {
            const settings = item.pageSettings || {};
            const isStory = item.components?.some(c => c.type === 'scene');
            
            if (isStory) {
                const firstScene = item.components.find(c => c.type === 'scene');
                thumbnailUrl = firstScene?.sceneSettings?.bgImage;
                mediaTypeIcon = '✨';
            } else if (settings.bgVideo) {
                thumbnailUrl = settings.thumbnailUrl;
                mediaTypeIcon = '🎬';
            } else {
                thumbnailUrl = settings.bgImage;
                mediaTypeIcon = '🖼️';
            }
        } else { // card or iframe
            if (item.adType === 'iframe') {
                 thumbnailUrl = item.thumbnailUrl; // iframe도 썸네일이 있다면 표시
                 mediaTypeIcon = '🌐';
            } else if (item.mediaType === 'video') {
                thumbnailUrl = item.thumbnailUrl;
                mediaTypeIcon = '🎬';
            } else {
                thumbnailUrl = item.mediaUrl;
                mediaTypeIcon = '🖼️';
            }
        }

        if (thumbnailUrl) {
            return `<div class="preview" style="background-image: url('${thumbnailUrl}')"><span class="media-type-icon">${mediaTypeIcon}</span></div>`;
        }
        
        if (type === 'page') mediaTypeIcon = '📄';
        if (type === 'card' && item.adType === 'iframe') mediaTypeIcon = '🌐';
        else if (type === 'card') mediaTypeIcon = '🗂️';
        return `<div class="preview"><span class="media-type-icon">${mediaTypeIcon}</span></div>`;
    };

    modalElements.pagesListContainer.innerHTML = pagesList.map(page => {
        const isAdded = currentLayoutIds.includes(page.id);
        return `
            <div class="add-content-item">
                <div class="item-info">
                    ${getThumbnailHtml(page, 'page')}
                    <span class="title">${page.name}</span>
                </div>
                <button class="add-button" data-id="${page.id}" ${isAdded ? 'disabled' : ''}>${isAdded ? '추가됨' : '추가'}</button>
            </div>`;
    }).join('') || `<p class="text-slate-500 text-center py-4">추가할 페이지가 없습니다.</p>`;

    modalElements.cardsListContainer.innerHTML = cards.list.map(card => {
        const isAdded = currentLayoutIds.includes(card.id);
        return `
            <div class="add-content-item">
                <div class="item-info">
                    ${getThumbnailHtml(card, 'card')}
                    <span class="title">${card.title}</span>
                </div>
                <button class="add-button" data-id="${card.id}" ${isAdded ? 'disabled' : ''}>${isAdded ? '추가됨' : '추가'}</button>
            </div>`;
    }).join('') || `<p class="text-slate-500 text-center py-4">추가할 카드가 없습니다.</p>`;

    switchTab('pages');
    modalElements.modal.classList.add('active');
}

export function initLayoutView() {
    initHomeDashboard();
    if (isInitialized) {
        return;
    }
    mapModalUI();
    setupModalListeners();
    listenToLayoutChanges('mainLayout');
    isInitialized = true;
    console.log("Layout View Initialized.");
}