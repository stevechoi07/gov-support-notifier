// js/pages.js v2.4 - 새 페이지 생성 시 isMembersOnly: false 자동 추가

import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { ui } from './ui.js';
import { firebaseReady, getFirestoreDB } from './firebase.js';

export let pagesList = [];
let isInitialized = false;

let resolvePagesReady;
export const pagesReady = new Promise(resolve => {
    resolvePagesReady = resolve;
});

export async function renderPages() {
    const { navigateTo } = await import('./navigation.js');

    if (!ui.pageListContainer) return;
    ui.pageListContainer.className = 'page-grid';
    ui.pageListContainer.innerHTML = pagesList.length === 0
        ? `<p class="text-center text-slate-400 py-8 col-span-full">생성된 페이지가 없습니다.</p>`
        : pagesList.map(page => {
            const lastUpdated = page.updatedAt ? new Date(page.updatedAt.seconds * 1000).toLocaleString() : '정보 없음';
            const isPublished = page.isPublished || false;
            const bgColor = page.pageSettings?.bgColor || '#0f172a';
            const bgImage = page.pageSettings?.bgImage || '';
            const previewStyle = `background-color: ${bgColor}; ${bgImage ? `background-image: url('${bgImage}');` : ''}`;

            // ✨ [핵심 추가] 페이지가 스토리 유형인지 확인합니다.
            const isStory = page.components?.some(c => c.type === 'scene');
            const storyBadge = isStory ? `<span class="story-badge">✨ 스토리</span>` : '';

            return `
            <div class="page-card">
                <div class="page-card-preview" style="${previewStyle}">
                    <div class="title-wrapper">
                        <h4>${page.name}</h4>
                        ${storyBadge}
                    </div>
                </div>
                <div class="page-card-content">
                    <p class="page-card-info">최근 수정: ${lastUpdated}</p>
                    <div class="page-card-actions">
                        <div class="publish-info">
                            <label class="toggle-switch">
                                <input type="checkbox" class="publish-toggle" data-id="${page.id}" ${isPublished ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                            </label>
                            <span class="text-sm font-medium ${isPublished ? 'text-emerald-400' : 'text-slate-400'}">${isPublished ? '게시 중' : '비공개'}</span>
                        </div>
                        <div class="action-buttons">
                            <button class="edit-page-btn text-slate-300 hover:text-white" data-id="${page.id}" title="편집">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                            </button>
                            <button class="delete-page-btn text-red-400 hover:text-red-500" data-id="${page.id}" data-name="${page.name}" title="삭제">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');

    document.querySelectorAll('.publish-toggle').forEach(t => t.addEventListener('change', handlePublishToggleChange));
    document.querySelectorAll('.edit-page-btn').forEach(b => b.addEventListener('click', (e) => navigateTo('editor', e.currentTarget.dataset.id)));
    document.querySelectorAll('.delete-page-btn').forEach(b => b.addEventListener('click', handleDeletePageClick));
}


async function handlePublishToggleChange(e) { await firebaseReady; const db = getFirestoreDB(); const pageIdToChange = e.currentTarget.dataset.id; const isNowPublished = e.currentTarget.checked; try { const docRef = doc(db, "pages", pageIdToChange); await updateDoc(docRef, { isPublished: isNowPublished }); } catch (error) { console.error("게시 상태 변경 실패:", error); alert("게시 상태 변경에 실패했습니다."); e.currentTarget.checked = !isNowPublished; } }
async function handleDeletePageClick(e) { await firebaseReady; const db = getFirestoreDB(); const { id, name } = e.currentTarget.dataset; if (confirm(`'${name}' 페이지를 정말 삭제하시겠습니까?`)) { try { await deleteDoc(doc(db, "pages", id)); } catch (error) { alert("페이지 삭제에 실패했습니다."); } } }

export async function handleNewPageClick() {
    await firebaseReady;
    const db = getFirestoreDB();
    const name = prompt("새 페이지의 이름을 입력하세요:");
    if (name && name.trim()) {
        try {
            const newPageData = {
                name: name.trim(),
                isPublished: false,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                components: [],
                pageSettings: { bgColor: '#1e293b', bgImage: '', bgVideo: '', viewport: '375px,667px' },
                viewCount: 0,
                clickCount: 0,
                isMembersOnly: false // ✨ 바로 이 한 줄이 추가되었습니다!
            };
            const newPageRef = await addDoc(collection(db, "pages"), newPageData);
            return newPageRef.id;
        } catch (error) {
            alert("새 페이지 생성에 실패했습니다.");
            return null;
        }
    }
    return null;
}

async function listenToPages() { 
	await firebaseReady; 
	const db = getFirestoreDB(); 
	const q = query(collection(db, "pages"), orderBy("createdAt", "desc")); onSnapshot(q, (snapshot) => { pagesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); 
	const pagesView = document.getElementById('pages-view'); 
	if (ui.pageListContainer && pagesView && !pagesView.classList.contains('hidden')) { renderPages(); } 
	if (resolvePagesReady) { resolvePagesReady(); resolvePagesReady = null; } }); 
	}
export function init() { 
	if (isInitialized) { renderPages(); return; }; listenToPages(); isInitialized = true; }