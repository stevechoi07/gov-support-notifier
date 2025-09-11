// js/layout.js v1.4

import { doc, getDoc, onSnapshot, updateDoc, arrayRemove, arrayUnion } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getFirestoreDB } from './firebase.js';
import { showToast } from './ui.js';
import { pagesList } from './pages.js';
import { cards } from './cards.js';

const layoutListContainer = document.getElementById('layout-list-container');
const modalElements = {};
let sortableInstance = null;
let currentLayoutIds = [];

function listenToLayoutChanges(layoutId) {
    const db = getFirestoreDB();
    const layoutRef = doc(db, "layouts", layoutId);
    onSnapshot(layoutRef, async (snapshot) => {
        if (!snapshot.exists() || !snapshot.data().contentIds) {
            console.log("Layout data not found or is empty.");
            currentLayoutIds = [];
            renderLayoutList([]);
            return;
        }
        const contentIds = snapshot.data().contentIds;
        currentLayoutIds = contentIds;
        
        const contents = await fetchContentsDetails(contentIds);
        renderLayoutList(contents);
    });
}

async function fetchContentsDetails(ids) {
    if (ids.length === 0) return [];
    const db = getFirestoreDB();

    const contentPromises = ids.map(id => {
        const collectionName = id.startsWith('page_') ? 'pages' : 'cards';
        const contentRef = doc(db, collectionName, id);
        return getDoc(contentRef);
    });

    const contentSnaps = await Promise.all(contentPromises);
    return contentSnaps.map(snap => snap.exists() ? { id: snap.id, ...snap.data() } : null).filter(Boolean);
}

function renderLayoutList(contents) {
    if (contents.length === 0) {
        layoutListContainer.innerHTML = `<div class="text-center py-16">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="mx-auto text-slate-600 mb-4"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
            <h3 class="text-lg font-semibold text-slate-400">레이아웃이 비어있습니다.</h3>
            <p class="text-slate-500 mt-1">상단의 '콘텐츠 추가' 버튼을 눌러 페이지나 카드를 추가해보세요.</p>
        </div>`;
        return;
    }

    const sortedContents = currentLayoutIds.map(id => contents.find(c => c.id === id)).filter(Boolean);

    layoutListContainer.innerHTML = sortedContents.map(content => {
        const isPage = content.id.startsWith('page_');
        const typeLabel = isPage ? '📄 페이지' : '🗂️ 카드';
        const typeColor = isPage ? 'bg-sky-500/20 text-sky-400' : 'bg-amber-500/20 text-amber-400';
        const previewImage = content.mediaUrl || content.backgroundColor || 'https://via.placeholder.com/150';

        return `
            <div class="layout-item flex items-center bg-slate-800 rounded-lg p-3 gap-4 shadow-sm" data-id="${content.id}">
                <div class="drag-handle cursor-move text-slate-600 hover:text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>
                </div>
                <div class="w-24 h-14 bg-cover bg-center rounded-md" style="background-image: url('${previewImage}')"></div>
                <div class="flex-1">
                    <h4 class="font-bold text-slate-200">${content.title || content.name}</h4>
                    <span class="text-xs font-semibold px-2 py-1 rounded-full ${typeColor}">${typeLabel}</span>
                </div>
                <div class="flex items-center gap-6">
                    <button class="remove-btn text-slate-500 hover:text-red-500 transition-colors" title="레이아웃에서 제거">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    attachEventListeners();
    initializeSortable();
}

function attachEventListeners() {
    document.querySelectorAll('.layout-item .remove-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const item = e.currentTarget.closest('.layout-item');
            const contentId = item.dataset.id;
            if (confirm(`'${item.querySelector('h4').textContent}' 콘텐츠를 레이아웃에서 제거하시겠습니까?`)) {
                const layoutRef = doc(getFirestoreDB(), "layouts", "mainLayout");
                await updateDoc(layoutRef, { contentIds: arrayRemove(contentId) });
                showToast('콘텐츠가 레이아웃에서 제거되었습니다.');
            }
        });
    });
}

function initializeSortable() {
    if (sortableInstance) sortableInstance.destroy();
    sortableInstance = new Sortable(layoutListContainer, {
        handle: '.drag-handle',
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: async (evt) => {
            const newOrder = Array.from(evt.to.children).map(item => item.dataset.id);
            const layoutRef = doc(getFirestoreDB(), "layouts", "mainLayout");
            await updateDoc(layoutRef, { contentIds: newOrder });
            showToast('레이아웃 순서가 저장되었습니다.', 'success');
        },
    });
}

function mapModalUI() {
    modalElements.modal = document.getElementById('add-content-modal');
    modalElements.closeButton = document.getElementById('close-add-content-modal-button');
    modalElements.finishButton = document.getElementById('finish-adding-content-button');
    modalElements.tabs = document.querySelectorAll('#add-content-tabs .tab-button');
    modalElements.tabContents = document.querySelectorAll('#add-content-modal .tab-content');
    modalElements.pagesListContainer = document.getElementById('add-content-pages-list');
    modalElements.cardsListContainer = document.getElementById('add-content-cards-list');
}

function setupModalListeners() {
    modalElements.closeButton.addEventListener('click', () => modalElements.modal.classList.remove('active'));
    modalElements.finishButton.addEventListener('click', () => modalElements.modal.classList.remove('active'));
    
    modalElements.tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    modalElements.modal.addEventListener('click', (e) => {
        if (e.target.classList.contains('add-button') && !e.target.disabled) {
            addItemToLayout(e.target.dataset.id);
        }
    });
}

function switchTab(tabName) {
    modalElements.tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabName));
    modalElements.tabContents.forEach(content => content.classList.toggle('active', content.id.includes(tabName)));
}

async function addItemToLayout(contentId) {
    try {
        const layoutRef = doc(getFirestoreDB(), "layouts", "mainLayout");
        await updateDoc(layoutRef, { contentIds: arrayUnion(contentId) });
        showToast('콘텐츠가 레이아웃에 추가되었습니다.');
    } catch (error) {
        console.error("레이아웃에 아이템 추가 실패:", error);
        showToast("아이템 추가에 실패했습니다.", "error");
    }
}

export function handleAddContentClick() {
    if (!modalElements.modal) {
        mapModalUI();
        setupModalListeners();
    }
    
    modalElements.pagesListContainer.innerHTML = pagesList.map(page => {
        const isAdded = currentLayoutIds.includes(page.id);
        const bgColor = page.backgroundColor || '#0f172a';
        return `
            <div class="add-content-item">
                <div class="item-info">
                    <div class="preview" style="background-color: ${bgColor};"></div>
                    <span class="title">${page.name}</span>
                </div>
                <button class="add-button" data-id="${page.id}" ${isAdded ? 'disabled' : ''}>
                    ${isAdded ? '추가됨' : '추가'}
                </button>
            </div>`;
    }).join('') || `<p class="text-slate-500 text-center">추가할 페이지가 없습니다.</p>`;

    modalElements.cardsListContainer.innerHTML = cards.list.map(card => {
        const isAdded = currentLayoutIds.includes(card.id);
        const previewStyle = card.mediaUrl ? `background-image: url('${card.mediaUrl}');` : 'background-color: #334155;';
        return `
            <div class="add-content-item">
                <div class="item-info">
                    <div class="preview" style="${previewStyle}"></div>
                    <span class="title">${card.title}</span>
                </div>
                <button class="add-button" data-id="${card.id}" ${isAdded ? 'disabled' : ''}>
                    ${isAdded ? '추가됨' : '추가'}
                </button>
            </div>`;
    }).join('') || `<p class="text-slate-500 text-center">추가할 콘텐츠 카드가 없습니다.</p>`;

    switchTab('pages');
    modalElements.modal.classList.add('active');
}

let isInitialized = false;
export function initLayoutView() {
    if (isInitialized) return;
    listenToLayoutChanges('mainLayout');
    isInitialized = true;
    console.log("Layout View Initialized.");
}