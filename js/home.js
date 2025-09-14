// js/home.js v1.0 - 미니 대시보드 기능 모듈

import { collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { firebaseReady, getFirestoreDB } from './firebase.js';
import { pagesList, pagesReady } from './pages.js';
import { cards, cardsReady } from './cards.js';

// ✨ 통계 데이터를 계산하는 함수
async function getDashboardStats() {
    // 페이지와 카드 데이터 로딩이 완료될 때까지 기다립니다.
    await Promise.all([pagesReady, cardsReady]);

    const pageCount = pagesList.length;
    const cardCount = cards.list.length;

    // 가장 많이 클릭된 카드를 찾기 위한 Firestore 쿼리
    const db = getFirestoreDB();
    const cardsRef = collection(db, 'ads');
    const q = query(cardsRef, orderBy('clickCount', 'desc'), limit(1));
    const querySnapshot = await getDocs(q);
    
    let topCard = null;
    if (!querySnapshot.empty) {
        // 클릭 수가 0보다 큰 경우에만 topCard로 인정합니다.
        const firstDoc = querySnapshot.docs[0].data();
        if (firstDoc.clickCount > 0) {
            topCard = firstDoc;
        }
    }

    return { pageCount, cardCount, topCard };
}

// ✨ 계산된 통계를 기반으로 HTML을 그려주는 함수
function renderDashboard(container, stats) {
    const { pageCount, cardCount, topCard } = stats;

    const topCardHTML = topCard
        ? `<p class="text-2xl font-bold text-white truncate" title="${topCard.title}">${topCard.title}</p>
           <p class="text-sm text-slate-400">${topCard.clickCount.toLocaleString()} clicks</p>`
        : `<p class="text-2xl font-bold text-slate-500">데이터 없음</p>
           <p class="text-sm text-slate-500">클릭 데이터가 있는 카드가 없습니다.</p>`;

    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="dashboard-stat-card bg-slate-800 p-6 rounded-xl">
                <div class="flex items-center">
                    <div class="p-3 rounded-lg bg-sky-500/20 mr-4">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-sky-400"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                    </div>
                    <div>
                        <p class="text-sm font-medium text-slate-400">총 페이지</p>
                        <p class="text-2xl font-bold text-white">${pageCount}개</p>
                    </div>
                </div>
            </div>
            <div class="dashboard-stat-card bg-slate-800 p-6 rounded-xl">
                <div class="flex items-center">
                    <div class="p-3 rounded-lg bg-amber-500/20 mr-4">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-amber-400"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
                    </div>
                    <div>
                        <p class="text-sm font-medium text-slate-400">총 콘텐츠 카드</p>
                        <p class="text-2xl font-bold text-white">${cardCount}개</p>
                    </div>
                </div>
            </div>
            <div class="dashboard-stat-card bg-slate-800 p-6 rounded-xl">
                <div class="flex items-center">
                    <div class="p-3 rounded-lg bg-emerald-500/20 mr-4">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-emerald-400"><path d="M12 21c-5 0-9-4.5-9-9.5s4-9.5 9-9.5 9 4.5 9 9.5-4.2 9.5-9 9.5Z"/><path d="M10 10a2 2 0 1 1 4 0 2 2 0 0 1-4 0Z"/><path d="m5 12 2-2"/><path d="m17 12 2-2"/></svg>
                    </div>
                    <div class="flex-1 overflow-hidden">
                        <p class="text-sm font-medium text-slate-400">인기 카드</p>
                        ${topCardHTML}
                    </div>
                </div>
            </div>
        </div>
        <hr class="border-slate-700 my-8">
    `;
}

// ✨ 외부에서 호출할 메인 함수
export async function initHomeDashboard() {
    const container = document.getElementById('home-dashboard-container');
    if (!container) return;

    // 로딩 중임을 표시
    container.innerHTML = `<p class="text-center text-slate-500">대시보드 데이터를 불러오는 중...</p>`;

    try {
        await firebaseReady;
        const stats = await getDashboardStats();
        renderDashboard(container, stats);
    } catch (error) {
        console.error("대시보드 초기화 실패:", error);
        container.innerHTML = `<p class="text-center text-red-500">대시보드 데이터를 불러오는 데 실패했습니다.</p>`;
    }
}