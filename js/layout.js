// js/layout.js
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { db } from './firebase.js';
import { pagesList } from './pages.js';
import { cards } from './cards.js';

let layoutList = [];
let isInitialized = false;
const modalElements = {};

function renderLayout() {
    const container = document.getElementById('layout-list-container');
    if (!container) return;
    container.innerHTML = `<p class="text-center text-slate-400 py-8">레이아웃에 추가된 콘텐츠가 없습니다. '콘텐츠 추가' 버튼을 눌러 페이지나 카드를 추가해주세요.</p>`;
}

function listenToLayout() {
    const q = query(collection(db, "mainLayout"), orderBy("order", "asc"));
    onSnapshot(q, (snapshot) => {
        layoutList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const layoutView = document.getElementById('layout-view');
        if (layoutView && !layoutView.classList.contains('hidden')) {
            renderLayout();
        }
    });
}

export function handleAddContentClick() {
    if (!modalElements.modal) {
        mapModalUI();
        setupModalListeners();
    }
    populatePageList();
    populateCardList();
    switchTab('pages');
    modalElements.modal.classList.add('active');
}

function populatePageList() {
    modalElements.pagesListContainer.innerHTML = pagesList.map(page => {
        const isAdded = layoutList.some(item => item.refId === page.id);
        const bgColor = page.pageSettings?.bgColor || '#0f172a';
        const bgImage = page.pageSettings?.bgImage || '';
        const previewStyle = `background-color: ${bgColor}; ${bgImage ? `background-image: url('${bgImage}');` : ''}`;
        return `<div class="add-content-item"><div class="item-info"><div class="preview" style="${previewStyle}"></div><span class="title">${page.name}</span></div><button class="add-button" data-type="page" data-id="${page.id}" ${isAdded ? 'disabled' : ''}>${isAdded ? '추가됨' : '추가'}</button></div>`;
    }).join('') || `<p class="text-slate-500">추가할 페이지가 없습니다.</p>`;
}

function populateCardList() {
    modalElements.cardsListContainer.innerHTML = cards.list.map(card => {
        const isAdded = layoutList.some(item => item.refId === card.id);
        const previewStyle = card.mediaUrl ? `background-image: url('${card.mediaUrl}');` : 'background-color: #334155;';
        return `<div class="add-content-item"><div class="item-info"><div class="preview" style="${previewStyle}"></div><span class="title">${card.title}</span></div><button class="add-button" data-type="card" data-id="${card.id}" ${isAdded ? 'disabled' : ''}>${isAdded ? '추가됨' : '추가'}</button></div>`;
    }).join('') || `<p class="text-slate-500">추가할 콘텐츠 카드가 없습니다.</p>`;
}

async function addItemToLayout(type, refId) {
    try {
        await addDoc(collection(db, 'mainLayout'), {
            order: layoutList.length, type: type, refId: refId, isPublished: true,
            viewCount: 0, clickCount: 0, createdAt: serverTimestamp(),
        });
    } catch (error) {
        console.error("레이아웃에 아이템 추가 실패:", error);
        alert("아이템 추가에 실패했습니다.");
    }
}

function mapModalUI() {
    modalElements.modal = document.getElementById('add-content-modal');
    modalElements.closeButton = document.getElementById('close-add-content-modal-button');
    modalElements.finishButton = document.getElementById('finish-adding-content-button');
    modalElements.tabs = document.querySelectorAll('.tab-button');
    modalElements.tabContents = document.querySelectorAll('.tab-content');
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
            const button = e.target;
            const { type, id } = button.dataset;
            addItemToLayout(type, id);
            button.disabled = true;
            button.textContent = '추가됨';
        }
    });
}

function switchTab(tabName) {
    modalElements.tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabName));
    modalElements.tabContents.forEach(content => content.classList.toggle('active', content.id.includes(tabName)));
}

export function init() {
    if (isInitialized) {
        renderLayout();
        return;
    }
    listenToLayout();
    isInitialized = true;
}