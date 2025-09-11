// js/layout.js v1.1 - 실시간 동기화 및 모달 기능 통합 버전

import { db } from './firebase.js';
import { doc, getDoc, updateDoc, arrayRemove, arrayUnion, onSnapshot } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { showToast } from './ui.js';

// 전역 변수로 관리하여 다른 함수에서도 접근 가능하게 합니다.
const layoutListContainer = document.getElementById('layout-list-container');
const modalElements = {};
let sortableInstance = null;
let currentLayoutIds = []; // 현재 레이아웃의 ID 목록을 저장

// --- 실시간 데이터 처리 및 렌더링 ---

// [핵심 업그레이드] 레이아웃 문서의 변경을 실시간으로 감지합니다.
function listenToLayoutChanges(layoutId) {
    const layoutRef = doc(db, "layouts", layoutId);
    onSnapshot(layoutRef, async (snapshot) => {
        if (!snapshot.exists() || !snapshot.data().contentIds) {
            console.log("Layout data not found or is empty.");
            currentLayoutIds = [];
            renderLayoutList([]); // 데이터가 없으면 빈 화면을 렌더링
            return;
        }
        const contentIds = snapshot.data().contentIds;
        currentLayoutIds = contentIds;
        
        // ID 목록을 바탕으로 상세 정보를 가져와 화면을 다시 그립니다.
        const contents = await fetchContentsDetails(contentIds);
        renderLayoutList(contents);
    });
}

// 주어진 ID 배열을 바탕으로 각 콘텐츠의 상세 정보를 가져옵니다.
async function fetchContentsDetails(ids) {
    if (ids.length === 0) return [];

    const contentPromises = ids.map(id => {
        const collectionName = id.startsWith('page_') ? 'pages' : 'cards';
        const contentRef = doc(db, collectionName, id);
        return getDoc(contentRef);
    });

    const contentSnaps = await Promise.all(contentPromises);
    return contentSnaps.map(snap => snap.exists() ? { id: snap.id, ...snap.data() } : null).filter(Boolean);
}

// 화면에 레이아웃 목록을 그립니다. (v1.0의 렌더링 로직과 거의 동일)
function renderLayoutList(contents) {
    if (contents.length === 0) {
        layoutListContainer.innerHTML = `<div class="text-center py-16">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="mx-auto text-slate-600 mb-4"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
            <h3 class="text-lg font-semibold text-slate-400">레이아웃이 비어있습니다.</h3>
            <p class="text-slate-500 mt-1">상단의 '콘텐츠 추가' 버튼을 눌러 페이지나 카드를 추가해보세요.</p>
        </div>`;
        return;
    }

    // 순서 보장을 위해 currentLayoutIds 순서대로 contents 배열을 정렬합니다.
    const sortedContents = currentLayoutIds.map(id => contents.find(c => c.id === id)).filter(Boolean);

    layoutListContainer.innerHTML = sortedContents.map(content => {
        // (v1.0과 동일한 HTML 생성 로직) ...
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

// --- 이벤트 리스너 및 Sortable.js 초기화 ---

function attachEventListeners() {
    document.querySelectorAll('.layout-item .remove-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const item = e.currentTarget.closest('.layout-item');
            const contentId = item.dataset.id;
            if (confirm(`'${item.querySelector('h4').textContent}' 콘텐츠를 레이아웃에서 제거하시겠습니까?`)) {
                const layoutRef = doc(db, "layouts", "mainLayout");
                await updateDoc(layoutRef, { contentIds: arrayRemove(contentId) });
                showToast('콘텐츠가 레이아웃에서 제거되었습니다.');
                // onSnapshot이 화면을 자동으로 다시 그려주므로, DOM을 직접 조작할 필요가 없습니다!
            }
        });
    });
}

function initializeSortable() {
    if (sortableInstance) sortableInstance.destroy();
    sortableInstance = new Sortable(layoutListContainer, {
        handle: '.drag-handle', animation: 150, ghostClass: 'sortable-ghost',
        onEnd: async (evt) => {
            const newOrder = Array.from(evt.to.children).map(item => item.dataset.id);
            const layoutRef = doc(db, "layouts", "mainLayout");
            await updateDoc(layoutRef, { contentIds: newOrder });
            showToast('레이아웃 순서가 저장되었습니다.', 'success');
        },
    });
}

// --- '콘텐츠 추가' 모달 관련 기능 (기존 파일에서 가져와 개선) ---

// 모달 UI 요소를 한 번만 매핑합니다.
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
            e.target.disabled = true;
            e.target.textContent = '추가됨';
        }
    });
}

function switchTab(tabName) {
    modalElements.tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabName));
    modalElements.tabContents.forEach(content => content.classList.toggle('active', content.id.includes(tabName)));
}

// [핵심 업그레이드] 레이아웃에 아이템 추가 로직 변경 (addDoc -> updateDoc + arrayUnion)
async function addItemToLayout(contentId) {
    try {
        const layoutRef = doc(db, "layouts", "mainLayout");
        await updateDoc(layoutRef, {
            contentIds: arrayUnion(contentId)
        });
        showToast('콘텐츠가 레이아웃에 추가되었습니다.');
    } catch (error) {
        console.error("레이아웃에 아이템 추가 실패:", error);
        showToast("아이템 추가에 실패했습니다.", "error");
    }
}

// 모달을 열고 페이지/카드 목록을 채웁니다. (외부에서 호출)
export async function handleAddContentClick() {
    // 임시 데이터. 실제로는 pages.js와 cards.js에서 데이터를 가져와야 합니다.
    const tempPages = [{id: 'page_abc', name: '임시 페이지 1'}];
    const tempCards = [{id: 'card_xyz', title: '임시 카드 1', mediaUrl: 'https://via.placeholder.com/150'}];

    modalElements.pagesListContainer.innerHTML = tempPages.map(page => {
        const isAdded = currentLayoutIds.includes(page.id);
        return `<div class="add-content-item">... <button class="add-button" data-id="${page.id}" ${isAdded ? 'disabled' : ''}>${isAdded ? '추가됨' : '추가'}</button></div>`;
    }).join('');

    modalElements.cardsListContainer.innerHTML = tempCards.map(card => {
        const isAdded = currentLayoutIds.includes(card.id);
        return `<div class="add-content-item">... <button class="add-button" data-id="${card.id}" ${isAdded ? 'disabled' : ''}>${isAdded ? '추가됨' : '추가'}</button></div>`;
    });

    switchTab('pages');
    modalElements.modal.classList.add('active');
}


// --- 전체 기능 초기화 ---

let isInitialized = false;

// main.js에서 호출할 메인 함수
export function initLayoutView() {
    if (isInitialized) return;
    
    mapModalUI();
    setupModalListeners();
    listenToLayoutChanges('mainLayout'); // 실시간 리스너 시작!
    
    isInitialized = true;
    console.log("Layout View Initialized.");
}