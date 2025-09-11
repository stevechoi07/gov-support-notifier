// js/layout.js
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { db } from './firebase.js';
import { pagesList } from './pages.js'; // 페이지 목록 데이터 가져오기
import { cards } from './cards.js'; // 콘텐츠 카드 목록 데이터 가져오기

let layoutList = [];
let isInitialized = false;

// 모달 UI 요소를 담을 객체
const modalElements = {};

// 화면을 렌더링하는 함수 (지금은 비어있음)
function renderLayout() {
    const container = document.getElementById('layout-list-container');
    if (!container) return;
    
    // TODO: 여기에 실제 레이아웃 목록을 그리는 코드가 들어갑니다.
    container.innerHTML = `<p class="text-center text-slate-400 py-8">레이아웃에 추가된 콘텐츠가 없습니다. '콘텐츠 추가' 버튼을 눌러 페이지나 카드를 추가해주세요.</p>`;
}

// Firestore의 mainLayout 컬렉션 변경사항을 실시간으로 감지하는 함수
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

/**
 * '콘텐츠 추가' 버튼 클릭 이벤트 핸들러
 */
export function handleAddContentClick() {
    // 모달 UI 요소를 처음 한 번만 매핑
    if (!modalElements.modal) {
        mapModalUI();
        setupModalListeners();
    }
    
    // 모달을 열 때마다 목록을 새로고침
    populatePageList();
    populateCardList();

    // 첫 번째 탭을 활성화
    switchTab('pages');
    
    modalElements.modal.classList.add('active');
}

/**
 * 모달 안의 페이지 목록을 채우는 함수
 */
function populatePageList() {
    modalElements.pagesListContainer.innerHTML = pagesList.map(page => {
        const isAdded = layoutList.some(item => item.refId === page.id);
        const bgColor = page.pageSettings?.bgColor || '#0f172a';
        const bgImage = page.pageSettings?.bgImage || '';
        const previewStyle = `background-color: ${bgColor}; ${bgImage ? `background-image: url('${bgImage}');` : ''}`;

        return `
        <div class="add-content-item">
            <div class="item-info">
                <div class="preview" style="${previewStyle}"></div>
                <span class="title">${page.name}</span>
            </div>
            <button class="add-button" data-type="page" data-id="${page.id}" ${isAdded ? 'disabled' : ''}>
                ${isAdded ? '추가됨' : '추가'}
            </button>
        </div>`;
    }).join('');
}

/**
 * 모달 안의 카드 목록을 채우는 함수
 */
function populateCardList() {
    modalElements.cardsListContainer.innerHTML = cards.list.map(card => {
        const isAdded = layoutList.some(item => item.refId === card.id);
        const previewStyle = card.mediaUrl ? `background-image: url('${card.mediaUrl}');` : 'background-color: #334155;';

        return `
        <div class="add-content-item">
            <div class="item-info">
                <div class="preview" style="${previewStyle}"></div>
                <span class="title">${card.title}</span>
            </div>
            <button class="add-button" data-type="card" data-id="${card.id}" ${isAdded ? 'disabled' : ''}>
                ${isAdded ? '추가됨' : '추가'}
            </button>
        </div>`;
    }).join('');
}


/**
 * 선택한 콘텐츠를 mainLayout 컬렉션에 추가하는 함수
 * @param {string} type 'page' 또는 'card'
 * @param {string} refId 원본 콘텐츠의 ID
 */
async function addItemToLayout(type, refId) {
    try {
        await addDoc(collection(db, 'mainLayout'), {
            order: layoutList.length, // 현재 목록의 맨 뒤에 추가
            type: type,
            refId: refId,
            isPublished: true, // 기본값은 게시 상태
            viewCount: 0,
            clickCount: 0,
            createdAt: serverTimestamp(),
        });
    } catch (error) {
        console.error("레이아웃에 아이템 추가 실패:", error);
        alert("아이템 추가에 실패했습니다.");
    }
}

/**
 * 모달 UI 요소를 매핑하는 함수
 */
function mapModalUI() {
    modalElements.modal = document.getElementById('add-content-modal');
    modalElements.closeButton = document.getElementById('close-add-content-modal-button');
    modalElements.finishButton = document.getElementById('finish-adding-content-button');
    modalElements.tabs = document.querySelectorAll('.tab-button');
    modalElements.tabContents = document.querySelectorAll('.tab-content');
    modalElements.pagesListContainer = document.getElementById('add-content-pages-list');
    modalElements.cardsListContainer = document.getElementById('add-content-cards-list');
}

/**
 * 모달의 이벤트 리스너들을 설정하는 함수
 */
function setupModalListeners() {
    modalElements.closeButton.addEventListener('click', () => modalElements.modal.classList.remove('active'));
    modalElements.finishButton.addEventListener('click', () => modalElements.modal.classList.remove('active'));

    modalElements.tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // 이벤트 위임을 사용하여 목록의 '추가' 버튼 클릭 처리
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

/**
 * 모달의 탭을 전환하는 함수
 * @param {string} tabName 'pages' 또는 'cards'
 */
function switchTab(tabName) {
    modalElements.tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabName));
    modalElements.tabContents.forEach(content => content.classList.toggle('active', content.id.includes(tabName)));
}

// layout.js 모듈의 초기화 함수
export function init() {
    if (isInitialized) {
        renderLayout();
        return;
    }
    listenToLayout();
    isInitialized = true;
    console.log("레이아웃 관리 모듈이 초기화되었습니다.");
}