// js/layout.js v1.0

import { db } from './firebase.js';
import { doc, getDoc, updateDoc, arrayRemove, arrayUnion } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { showToast } from './ui.js';

const layoutListContainer = document.getElementById('layout-list-container');
let sortableInstance = null;

// [1단계] Firestore에서 레이아웃 데이터 가져오기 + [2단계] 각 콘텐츠 상세 정보 불러오기
async function fetchLayoutContents(layoutId) {
    const layoutRef = doc(db, "layouts", layoutId);
    const layoutSnap = await getDoc(layoutRef);

    if (!layoutSnap.exists() || !layoutSnap.data().contentIds) {
        console.log("No layout data or contentIds found!");
        return [];
    }

    const contentIds = layoutSnap.data().contentIds;

    // contentIds 배열에 있는 모든 ID의 상세 정보를 병렬로 가져옵니다 (효율적!)
    const contentPromises = contentIds.map(async (id) => {
        // ID의 접두사를 보고 'pages'와 'cards' 컬렉션을 구분합니다.
        const collectionName = id.startsWith('page_') ? 'pages' : 'cards';
        const contentRef = doc(db, collectionName, id);
        const contentSnap = await getDoc(contentRef);
        
        if (contentSnap.exists()) {
            return { id: contentSnap.id, ...contentSnap.data() };
        }
        return null;
    });

    const contents = (await Promise.all(contentPromises)).filter(Boolean); // null이 아닌 것만 필터링
    return contents;
}

// [3단계] HTML 동적 생성 및 화면에 추가
function renderLayoutList(contents) {
    if (contents.length === 0) {
        layoutListContainer.innerHTML = `<div class="text-center py-16">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="mx-auto text-slate-600 mb-4"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
            <h3 class="text-lg font-semibold text-slate-400">레이아웃이 비어있습니다.</h3>
            <p class="text-slate-500 mt-1">상단의 '콘텐츠 추가' 버튼을 눌러 페이지나 카드를 추가해보세요.</p>
        </div>`;
        return;
    }

    layoutListContainer.innerHTML = contents.map(content => {
        const isPage = content.id.startsWith('page_');
        const typeLabel = isPage ? '📄 페이지' : '🗂️ 카드';
        const typeColor = isPage ? 'bg-sky-500/20 text-sky-400' : 'bg-amber-500/20 text-amber-400';
        
        // 미리보기 이미지 결정 (카드 미디어 > 페이지 배경 > 기본 아이콘)
        const previewImage = content.mediaUrl || content.backgroundColor || 'https://via.placeholder.com/150';

        return `
            <div class="layout-item flex items-center bg-slate-800 rounded-lg p-3 gap-4 shadow-sm" data-id="${content.id}">
                <div class="drag-handle cursor-move text-slate-600 hover:text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>
                </div>
                <div class="w-24 h-14 bg-cover bg-center rounded-md" style="background-image: url('${previewImage}')"></div>
                <div class="flex-1">
                    <h4 class="font-bold text-slate-200">${content.title}</h4>
                    <span class="text-xs font-semibold px-2 py-1 rounded-full ${typeColor}">${typeLabel}</span>
                </div>
                <div class="flex items-center gap-6">
                    <div>
                        <span class="text-sm text-slate-400">게시 상태</span>
                        <label class="relative inline-flex items-center cursor-pointer mt-1">
                            <input type="checkbox" value="" class="sr-only peer" ${content.published ? 'checked' : ''}>
                            <div class="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                    </div>
                    <button class="remove-btn text-slate-500 hover:text-red-500 transition-colors" title="레이아웃에서 제거">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // [4단계] 컨트롤 기능에 이벤트 리스너 연결
    attachEventListeners();
    initializeSortable();
}

function attachEventListeners() {
    document.querySelectorAll('.layout-item .remove-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const item = e.currentTarget.closest('.layout-item');
            const contentId = item.dataset.id;
            if (confirm(`'${item.querySelector('h4').textContent}' 콘텐츠를 레이아웃에서 제거하시겠습니까?`)) {
                // Firestore에서 제거 로직 (arrayRemove 사용)
                const layoutRef = doc(db, "layouts", "mainLayout");
                await updateDoc(layoutRef, {
                    contentIds: arrayRemove(contentId)
                });
                item.style.opacity = 0;
                setTimeout(() => item.remove(), 300); // 애니메이션 후 DOM에서 제거
                showToast('콘텐츠가 레이아웃에서 제거되었습니다.');
            }
        });
    });
    // (참고) 토글 스위치 이벤트 리스너는 다음 단계에서 구현합니다.
}

function initializeSortable() {
    if (sortableInstance) {
        sortableInstance.destroy();
    }
    sortableInstance = new Sortable(layoutListContainer, {
        handle: '.drag-handle',
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: async (evt) => {
            const items = Array.from(layoutListContainer.children);
            const newOrder = items.map(item => item.dataset.id);
            
            // Firestore에 새로운 순서 저장
            const layoutRef = doc(db, "layouts", "mainLayout");
            await updateDoc(layoutRef, { contentIds: newOrder });
            showToast('레이아웃 순서가 저장되었습니다.', 'success');
        },
    });
}

// 이 함수를 main.js에서 호출하여 레이아웃 뷰를 초기화합니다.
export async function initLayoutView() {
    const contents = await fetchLayoutContents('mainLayout');
    renderLayoutList(contents);
}