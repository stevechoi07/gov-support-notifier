// js/main.js - 2단계 전체 코드

// --- 1. 모듈 가져오기 (부품 조립) ---
import { auth, db, storage } from './firebase.js';
import { ui, mapInitialUI, mapDashboardUI } from './ui.js';
import { getAuth, signInWithCustomToken, signOut, onAuthStateChanged, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, writeBatch, query, getDoc, serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";

console.log('2단계 성공: main.js에 함수 정의 후에도 살아있다!');

// --- 2. 전역 변수 및 상태 관리 ---
let pagesCollection;
let pagesList = [];

// --- 3. 앱 초기화 및 메인 로직 ---
async function initializeAppAndAuth() {
    try {
        pagesCollection = collection(db, "pages");
        
        mapInitialUI();
        setupLoginListeners();
        
        Coloris({
            el: '[data-color-picker]', theme: 'large', themeMode: 'dark', alpha: false, format: 'hex',
            swatches: [ '#0f172a', '#334155', '#e2e8f0', '#34d399', '#f87171', '#fb923c', '#facc15', '#4ade80', '#60a5fa', '#c084fc' ]
        });

        onAuthStateChanged(auth, user => {
            if (user) {
                ui.authContainer.classList.add('hidden');
                ui.dashboardContainer.classList.remove('hidden');
                
                setTimeout(() => {
                    mapDashboardUI();
                    setupDashboardListeners();
                    listenToPages();
                    cards.init();
                    navigateTo('pages');
                }, 0);
            } else {
                ui.authContainer.classList.remove('hidden');
                ui.dashboardContainer.classList.add('hidden');
            }
            if (ui.loginButton) ui.loginButton.disabled = false;
        });

    } catch (error) {
        console.error("initializeAppAndAuth 함수에서 에러 발생:", error);
        showAuthMessage("초기화 실패. 관리자에게 문의하세요.", true);
        if (ui.loginButton) ui.loginButton.disabled = true;
    }
}

// --- 4. 이벤트 리스너 설정 ---
function setupLoginListeners() {
    if (ui.loginButton) {
        ui.loginButton.addEventListener('click', handleLogin);
    }
    if (ui.passwordInput) {
        ui.passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); });
    }
}

function setupDashboardListeners() {
    ui.logoutButton.addEventListener('click', handleLogout);
    ui.navLinks.forEach(link => link.addEventListener('click', (e) => { e.preventDefault(); navigateTo(link.dataset.view); }));
}

// --- 5. 함수 선언 (추후 다른 파일로 이동 예정) ---

// [ 인증 관련 함수 ]
async function handleLogin() {
    console.log("🔍 handleLogin 함수 실행!");
    ui.loginButton.disabled = true;
    ui.loginButton.innerHTML = `<div class="spinner"></div><span>로그인 중...</span>`;
    
    try {
        await setPersistence(auth, browserSessionPersistence);
        console.log("   -> Firebase 인증 지속성 설정 완료.");

        console.log("   -> Netlify 로그인 함수에 요청 전송 시작...");
        const response = await fetch('/.netlify/functions/login', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ password: ui.passwordInput.value }) 
        });
        console.log("   -> Netlify 함수로부터 응답 받음:", response);

        const result = await response.json();
        console.log("   -> 응답 결과(JSON):", result);

        if (!response.ok || !result.success) {
            throw new Error(result.message || "비밀번호가 틀렸습니다.");
        }

        console.log("   -> Firebase 커스텀 토큰으로 로그인 시도...");
        await signInWithCustomToken(auth, result.token);
        console.log("   -> Firebase 로그인 성공!");

    } catch (error) { 
        console.error("❌ handleLogin 함수에서 에러 발생:", error);
        showAuthMessage(error.message, true);
        ui.loginButton.disabled = false;
        ui.loginButton.innerHTML = '로그인';
    }
}

async function handleLogout() { 
    if (confirm('로그아웃 하시겠습니까?')) { 
        await signOut(auth); 
    } 
}

function showAuthMessage(message, isError) {
    if (!ui.authMessage) return;
    ui.authMessage.textContent = message;
    ui.authMessage.className = `text-sm text-center mt-4 ${isError ? 'text-red-500' : 'text-slate-500'}`;
    if (isError) ui.authMessage.classList.remove('hidden');
}


// [ 페이지 관리 관련 함수 ]
function listenToPages() {
    const q = query(pagesCollection, orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        pagesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (ui.pageListContainer && !document.getElementById('pages-view').classList.contains('hidden')) {
            renderPages();
        }
    });
}

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
    if(confirm(`'${name}' 페이지를 정말 삭제하시겠습니까?`)) {
        try { await deleteDoc(doc(db, "pages", id)); } catch (error) { alert("페이지 삭제에 실패했습니다."); }
    }
}

async function handleNewPageClick() {
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


// [ 네비게이션 함수 ]
function navigateTo(viewName, pageId = null) {
    const targetView = document.getElementById(`${viewName}-view`);
    if (!targetView) {
        console.error(`View not found: ${viewName}-view`);
        return;
    }

    ui.views.forEach(view => view.classList.add('hidden'));
    ui.navLinks.forEach(link => {
        const isActive = (viewName === 'editor' && link.dataset.view === 'pages') || viewName === link.dataset.view;
        link.classList.toggle('active', isActive);
    });
    
    targetView.classList.remove('hidden');
    ui.mainContent.classList.toggle('p-6', viewName !== 'editor');

    if (ui.viewTitle.isContentEditable) {
        ui.viewTitle.setAttribute('contenteditable', 'false');
    }

    const viewConfig = {
        pages: { title: '📄 페이지 관리', action: `<button id="new-page-btn" class="bg-emerald-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-emerald-600">✨ 새 페이지</button>` },
        cards: { title: '🗂️ 콘텐츠 카드 관리', action: `
            <div class="flex gap-2">
                <button id="add-new-iframe-card-button" class="bg-indigo-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-600">➕ iframe 카드</button>
                <button id="add-new-card-button" class="bg-emerald-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-emerald-600">➕ 미디어 카드</button>
            </div>` 
        },
        editor: { title: '📝 페이지 편집 중...', action: ''}
    };

    ui.viewTitle.textContent = viewConfig[viewName]?.title || 'Dashboard';
    ui.headerActions.innerHTML = viewConfig[viewName]?.action || '';
    
    if (viewName === 'pages') {
        const newPageBtn = document.getElementById('new-page-btn');
        if (newPageBtn) newPageBtn.addEventListener('click', handleNewPageClick);
        renderPages();
    } else if (viewName === 'editor' && pageId) {
        editor.init(pageId);
    } else if (viewName === 'cards') {
        const newCardBtn = document.getElementById('add-new-card-button');
        const newIframeCardBtn = document.getElementById('add-new-iframe-card-button');
        if(newCardBtn) newCardBtn.addEventListener('click', () => cards.handleAddNewAd());
        if(newIframeCardBtn) newIframeCardBtn.addEventListener('click', () => cards.handleAddNewIframeAd());
        cards.render();
    }
}