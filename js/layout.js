// js/layout.js
import { collection, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { db } from './firebase.js';

let layoutList = [];
let isInitialized = false;

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

export function init() {
    if (isInitialized) {
        renderLayout();
        return;
    }
    
    listenToLayout();
    isInitialized = true;
    console.log("레이아웃 관리 모듈이 초기화되었습니다.");
}