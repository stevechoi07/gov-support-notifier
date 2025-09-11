// js/pages.js
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { db } from './firebase.js';
import { ui } from './ui.js';
import { navigateTo } from './navigation.js';

let pagesCollection;
export let pagesList = []; // editor.js에서 참조할 수 있도록 export
let isInitialized = false;

function renderPages() {
    if (!ui.pageListContainer) return;
    ui.pageListContainer.innerHTML = pagesList.length === 0
        ? `<p class="text-center text-slate-400 py-8">생성된 페이지가 없습니다.</p>`
        : pagesList.map(page => {
            const lastUpdated = page.updatedAt ? new Date(page.updatedAt.seconds * 1000).toLocaleString() : '정보 없음';
            const isPublished = page.isPublished || false;
            return `
            <div class="bg-slate-800 rounded-lg p-4 flex items-center justify-between">
                <div class="flex items-center gap-4"><div class="w-2 h-10 rounded-full ${isPublished ? 'bg-emerald-400' : 'bg-slate-600'}"></div>
                    <div><h4 class="font-bold text-lg text-slate-100">${page.name}</h4><p class="text-sm text-slate-400">최근 수정: ${lastUpdated}</p></div>
                </div>
                <div class="flex items-center gap-4">
                    <div class="flex items-center gap-2"><span class="text-sm font-medium ${isPublished ? 'text-emerald-400' : 'text-slate-400'}">${isPublished ? '게시 중' : '비공개'}</span><label class="toggle-switch"><input type="checkbox" class="publish-toggle" data-id="${page.id}" ${isPublished ? 'checked' : ''}><span class="toggle-slider"></span></label></div>
                    <button class="edit-page-btn text-slate-300 hover:text-white" data-id="${page.id}" title="편집"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></button>
                    <button class="delete-page-btn text-red-400 hover:text-red-500" data-id="${page.id}" data-name="${page.name}" title="삭제"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                </div>
            </div>`;
        }).join('');

    document.querySelectorAll('.publish-toggle').forEach(t => t.addEventListener('change', handlePublishToggleChange));
    document.querySelectorAll('.edit-page-btn').forEach(b => b.addEventListener('click', (e) => navigateTo('editor', e.currentTarget.dataset.id)));
    document.querySelectorAll('.delete-page-btn').forEach(b => b.addEventListener('click', handleDeletePageClick));
}


async function handlePublishToggleChange(e) {
    const pageIdToChange = e.currentTarget.dataset.id;
    const isNowPublished = e.currentTarget.checked;
    try {
        const docRef = doc(db, "pages", pageIdToChange);
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
        try { await deleteDoc(doc(db, "pages", id)); } catch (error) { alert("페이지 삭제에 실패했습니다."); }
    }
}

export async function handleNewPageClick() {
    const name = prompt("새 페이지의 이름을 입력하세요:");
    if (name && name.trim()) {
        try {
            const newPageRef = await addDoc(collection(db, "pages"), {
                name: name.trim(), isPublished: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), components: [],
                pageSettings: { bgColor: '#DCEAF7', bgImage: '', bgVideo: '', viewport: '375px,667px' }
            });
            navigateTo('editor', newPageRef.id);
        } catch (error) { alert("새 페이지 생성에 실패했습니다."); }
    }
}

function listenToPages() {
    const q = query(collection(db, "pages"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        pagesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const pagesView = document.getElementById('pages-view');
        if (ui.pageListContainer && pagesView && !pagesView.classList.contains('hidden')) {
            renderPages();
        }
    });
}

export function init() {
    if (isInitialized) {
        renderPages();
        return;
    };
    listenToPages();
    isInitialized = true;
}