// js/layout.js
import { collection, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { db } from './firebase.js';

let layoutCollection;
let layoutList = [];
let isInitialized = false;

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
        
        // 현재 레이아웃 관리 화면이 보일 때만 렌더링
        const layoutView = document.getElementById('layout-view');
        if (layoutView && !layoutView.classList.contains('hidden')) {
            renderLayout();
        }
    });
}

// layout.js 모듈의 초기화 함수
export function init() {
    // 이미 초기화되었다면, 다시 렌더링만 수행
    if (isInitialized) {
        renderLayout();
        return;
    }
    
    // Firestore 리스너를 설정하고 초기화 완료 상태로 변경
    listenToLayout();
    isInitialized = true;
    console.log("레이아웃 관리 모듈이 초기화되었습니다.");
}