// js/pages.js v1.5

import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getFirestoreDB } from './firebase.js';
import { ui } from './ui.js';
// 'navigate' 이벤트를 사용하므로 navigateTo 직접 import는 필요 없습니다.

export let pagesList = []; // editor.js, layout.js 등에서 참조할 수 있도록 export
let isInitialized = false;

function renderPages() {
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

            return `
            <div class="page-card">
                <div class="page-card-preview" style="${previewStyle}">
                    <h4>${page.name}</h4>
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
    document.querySelectorAll('.edit-page-btn').forEach(b => b.addEventListener('click', (e) => {
        document.dispatchEvent(new CustomEvent('navigate', { 
            detail: { view: 'editor', pageId: e.currentTarget.dataset.id } 
        }));
    }));
    document.querySelectorAll('.delete-page-btn').forEach(b => b.addEventListener('click', handleDeletePageClick));
}

async function handlePublishToggleChange(e) {
    const pageIdToChange = e.currentTarget.dataset.id;
    const isNowPublished = e.currentTarget.checked;
    try {
        const docRef = doc(getFirestoreDB(), "pages", pageIdToChange);
        await updateDoc(docRef, { isPublished: isNowPublished });
    } catch (error) {
        console.error("게시 상태 변경 실패:", error);
        alert("게시 상태 변경에 실패했습니다.");
        e.currentTarget.checked = !isNowPublished;
    }
}

async function handleDeletePageClick(e) {
    const { id, name } = e.currentTarget.dataset;
    if (confirm(`'${name}' 페이지를 정말 삭제하시겠습니까?`)) {
        try { 
            await deleteDoc(doc(getFirestoreDB(), "pages", id)); 
        } catch (error) { 
            console.error("페이지 삭제 실패:", error);
            alert("페이지 삭제에 실패했습니다."); 
        }
    }
}

export async function handleNewPageClick() {
    const name = prompt("새 페이지의 이름을 입력하세요:");
    if (name && name.trim()) {
        try {
            const newPageRef = await addDoc(collection(getFirestoreDB(), "pages"), {
                name: name.trim(), 
                isPublished: false, 
                createdAt: serverTimestamp(), 
                updatedAt: serverTimestamp(), 
                components: [],
                pageSettings: { bgColor: '#1e293b', bgImage: '', bgVideo: '', viewport: '375px,667px' }
            });
            document.dispatchEvent(new CustomEvent('navigate', {
                detail: { view: 'editor', pageId: newPageRef.id }
            }));
        } catch (error) { 
            console.error("새 페이지 생성 실패:", error);
            alert("새 페이지 생성에 실패했습니다."); 
        }
    }
}

function listenToPages() {
    const q = query(collection(getFirestoreDB(), "pages"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        pagesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const pagesView = document.getElementById('pages-view');
        if (ui.pageListContainer && pagesView && !pagesView.classList.contains('hidden')) {
            renderPages();
        }
    }, (error) => {
        console.error("Error listening to pages collection:", error);
    });
}

export function initPagesView() {
    if (isInitialized) {
        renderPages();
        return;
    };
    listenToPages();
    isInitialized = true;
    console.log("Pages View Initialized.");
}