// js/main.js v1.0 - Clean Slate Version




// --- 1. 모듈 가져오기 (부품 조립) ---
import { auth, db, storage } from './firebase.js';
import { ui, mapInitialUI, mapDashboardUI } from './ui.js';
import { getAuth, signInWithCustomToken, signOut, onAuthStateChanged, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, writeBatch, query, getDoc, serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";

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
            console.log("onAuthStateChanged 이벤트 발생!", user); // ◀◀◀ 1. 감시자 동작 확인
            if (user) {
                console.log("✅ 사용자 확인됨, 대시보드 UI로 전환 시도..."); // ◀◀◀ 2. 로그인 성공 확인
                ui.authContainer.classList.add('hidden');
                ui.dashboardContainer.classList.remove('hidden');
                
                setTimeout(() => {
                    console.log("대시보드 초기화 작업 시작..."); // ◀◀◀ 3. 대시보드 준비 시작
                    mapDashboardUI();
                    console.log("-> mapDashboardUI() 실행 완료.");
                    setupDashboardListeners();
                    console.log("-> setupDashboardListeners() 실행 완료.");
                    listenToPages();
                    console.log("-> listenToPages() 실행 완료.");
                    cards.init();
                    console.log("-> cards.init() 실행 완료.");
                    navigateTo('pages');
                    console.log("-> navigateTo('pages') 실행 완료.");
                }, 0);
            } else {
                console.log("사용자 없음, 로그인 화면 유지.");
                ui.authContainer.classList.remove('hidden');
                ui.dashboardContainer.classList.add('hidden');
            }
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
    ui.loginButton.disabled = true;
    ui.loginButton.innerHTML = `<div class="spinner"></div><span>로그인 중...</span>`;

    try {
        await setPersistence(auth, browserSessionPersistence);
        const response = await fetch('/.netlify/functions/login', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ password: ui.passwordInput.value }) 
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "비밀번호가 틀렸습니다.");
        }

        await signInWithCustomToken(auth, result.token);

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
// main.js 파일의 navigateTo 함수를 아래 코드로 교체

function navigateTo(viewName, pageId = null) {
    const targetView = document.getElementById(`${viewName}-view`);
    if (!targetView) {
        console.error(`View not found: ${viewName}-view`);
        return;
    }

    if (ui.views) ui.views.forEach(view => view.classList.add('hidden'));
    if (ui.navLinks) ui.navLinks.forEach(link => {
        const isActive = (viewName === 'editor' && link.dataset.view === 'pages') || viewName === link.dataset.view;
        link.classList.toggle('active', isActive);
    });
    
    targetView.classList.remove('hidden');
    if (ui.mainContent) ui.mainContent.classList.toggle('p-6', viewName !== 'editor');

    if (ui.viewTitle && ui.viewTitle.isContentEditable) {
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

    if (ui.viewTitle) ui.viewTitle.textContent = viewConfig[viewName]?.title || 'Dashboard';
    if (ui.headerActions) ui.headerActions.innerHTML = viewConfig[viewName]?.action || '';
    
    if (viewName === 'pages') {
        const newPageBtn = document.getElementById('new-page-btn');
        if (newPageBtn) newPageBtn.addEventListener('click', handleNewPageClick);
        renderPages();
    } else if (viewName === 'editor' && pageId) {
        editor.init(pageId);
    } else if (viewName === 'cards') {
        cards.mapUI();
        cards.addEventListeners();

        const newCardBtn = document.getElementById('add-new-card-button');
        const newIframeCardBtn = document.getElementById('add-new-iframe-card-button');
        
        if(newCardBtn) {
            newCardBtn.addEventListener('click', () => cards.handleAddNewAd());
        }
        if(newIframeCardBtn) {
            newIframeCardBtn.addEventListener('click', () => cards.handleAddNewIframeAd());
        }
        
        cards.render();
    }
}

// ===============================================================
// 🚀 Page Editor Logic
// ===============================================================
const editor = {
  currentPageId: null, components: [], pageSettings: {}, activeComponentId: null, 
  sortableInstance: null, elements: {},
  viewportOptions: [
      { id: 'mobile',  label: '🤳', value: '375px,667px',  title: '모바일' },
      { id: 'tablet',  label: '📱', value: '768px,1024px', title: '태블릿' },
      { id: 'desktop', label: '🖥️', value: '1280px,800px', title: '데스크탑' },
      { id: 'full',    label: '전체', value: '100%,100%',   title: '전체 화면' }
  ],
  allPossibleFormFields: [ { name: 'name', label: '이름', type: 'text', placeholder: '이름을 입력하세요' }, { name: 'email', label: '이메일', type: 'email', placeholder: '이메일 주소를 입력하세요' }, { name: 'phone', label: '전화번호', type: 'tel', placeholder: '전화번호를 입력하세요' }, { name: 'birthdate', label: '생년월일', type: 'date', placeholder: '' }, { name: 'gender', label: '성별', type: 'text', placeholder: '성별을 입력하세요' } ],
  async init(pageId) {
      this.currentPageId = pageId;
      document.getElementById('editor-view').innerHTML = `
      <div class="editor-main-container">
          <div id="editor-controls-wrapper"><div class="editor-control-panel">
              <div class="control-group"><button id="back-to-list-btn" style="background-color: #475569; color: white;">← 목록으로 돌아가기</button></div>
              <h3>- 콘텐츠 블록 추가 -</h3>
              <div class="control-group component-adders" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;"><button data-type="heading">➕ 제목</button><button data-type="paragraph">➕ 내용</button><button data-type="button">➕ 버튼</button><button data-type="lead-form">➕ 고객 정보</button></div><hr style="border-color: var(--border-color); margin: 20px 0;">
              <h3>- 페이지 배경 -</h3>
              <div class="control-group inline-group"><label for="page-bg-color">배경색</label><input type="text" data-color-picker id="page-bg-color"></div>
              <div class="control-group"><label for="page-background-image">배경 이미지 URL</label><input type="text" id="page-background-image"></div>
              <div class="control-group"><label for="page-background-video">배경 동영상 URL</label><input type="text" id="page-background-video"></div><hr style="border-color: var(--border-color); margin: 20px 0;">
              <div id="editors-container"></div>
          </div></div>
          <div id="editor-preview-container" class="bg-slate-800"><div class="editor-control-panel">
              <div id="viewport-controls-left"></div> <div id="editor-preview-wrapper"><div id="editor-preview"><video class="background-video" autoplay loop muted playsinline></video><div class="background-image-overlay"></div><div class="content-area"></div></div></div>
          </div></div>
      </div>`;
      this.elements = {
          preview: document.getElementById('editor-preview'), contentArea: document.getElementById('editor-preview').querySelector('.content-area'),
          backgroundImageOverlay: document.getElementById('editor-preview').querySelector('.background-image-overlay'), backgroundVideo: document.getElementById('editor-preview').querySelector('.background-video'),
          editorsContainer: document.getElementById('editors-container'), adders: document.querySelectorAll('.component-adders button'),
          pageBgColorInput: document.getElementById('page-bg-color'), pageBackgroundImageInput: document.getElementById('page-background-image'),
          pageBackgroundVideoInput: document.getElementById('page-background-video'), viewportControlsLeft: document.getElementById('viewport-controls-left'),
          backToListBtn: document.getElementById('back-to-list-btn')
      };
      await this.loadProject();
      this.setupEventListeners();
  },
  async loadProject() {
      const docRef = doc(db, "pages", this.currentPageId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
          const data = docSnap.data();
          this.components = data.components || [];
          this.pageSettings = data.pageSettings || { viewport: '375px,667px' };
          const pageTitle = data.name || '페이지';
          ui.viewTitle.textContent = pageTitle;
          ui.viewTitle.setAttribute('contenteditable', 'true');
          ui.viewTitle.setAttribute('data-original-title', pageTitle);
      } else { navigateTo('pages'); }
      this.renderAll();
  },
  setupEventListeners() {
      this.elements.adders.forEach(button => button.addEventListener('click', () => this.addComponent(button.dataset.type)));
      this.elements.pageBgColorInput.addEventListener('input', (e) => {
          this.pageSettings.bgColor = e.target.value;
          this.saveAndRender(false, true);
      });
      this.elements.pageBackgroundImageInput.addEventListener('input', (e) => { this.pageSettings.bgImage = e.target.value; this.saveAndRender(false, true); });
      this.elements.pageBackgroundVideoInput.addEventListener('input', (e) => { this.pageSettings.bgVideo = e.target.value; this.saveAndRender(false, true); });
      this.elements.backToListBtn.addEventListener('click', () => navigateTo('pages'));
      ui.viewTitle.addEventListener('blur', () => this.handleTitleUpdate());
      ui.viewTitle.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
              e.preventDefault();
              ui.viewTitle.blur();
          }
      });
  },
  async handleTitleUpdate() {
      const newTitle = ui.viewTitle.textContent.trim();
      const originalTitle = ui.viewTitle.dataset.originalTitle;
      if (!newTitle) {
          alert('제목은 비워둘 수 없습니다.');
          ui.viewTitle.textContent = originalTitle;
          return;
      }
      if (newTitle === originalTitle) return;
      try {
          const docRef = doc(db, "pages", this.currentPageId);
          await updateDoc(docRef, { name: newTitle });
          ui.viewTitle.dataset.originalTitle = newTitle;
          const pageInList = pagesList.find(p => p.id === this.currentPageId);
          if(pageInList) pageInList.name = newTitle;
      } catch (error) {
          console.error("페이지 제목 업데이트 실패:", error);
          alert("제목 업데이트에 실패했습니다.");
          ui.viewTitle.textContent = originalTitle;
      }
  },
  renderAll() { this.renderPreview(); this.renderControls(); this.renderViewportControls(); this.initSortable(); },
  hexToRgba(hex, alpha = 1) { 
      if (!/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) return hex;
      let c = hex.substring(1).split(''); 
      if (c.length === 3) { c = [c[0], c[0], c[1], c[1], c[2], c[2]]; } 
      c = '0x' + c.join(''); 
      return `rgba(${[(c>>16)&255, (c>>8)&255, c&255].join(',')},${alpha})`; 
  },
  renderPreview() {
    this.elements.contentArea.innerHTML = '';
    const { bgVideo, bgImage, bgColor, viewport } = this.pageSettings;
    if (bgVideo) { this.elements.backgroundVideo.src = bgVideo; this.elements.backgroundVideo.style.display = 'block'; this.elements.backgroundImageOverlay.style.display = 'none'; this.elements.preview.style.backgroundColor = 'transparent'; this.elements.preview.classList.add('has-background'); } 
    else if (bgImage) { this.elements.backgroundVideo.style.display = 'none'; this.elements.backgroundImageOverlay.style.backgroundImage = `url('${bgImage}')`; this.elements.backgroundImageOverlay.style.display = 'block'; this.elements.preview.style.backgroundColor = 'transparent'; this.elements.preview.classList.add('has-background'); } 
    else { this.elements.backgroundVideo.style.display = 'none'; this.elements.backgroundImageOverlay.style.display = 'none'; this.elements.preview.style.backgroundColor = bgColor; this.elements.preview.classList.remove('has-background'); }
    const [width, height] = (viewport || '375px,667px').split(',');
    this.elements.preview.style.width = width; this.elements.preview.style.height = height;
    const hasBottomComponent = this.components.some(c => (c.type === 'button' || c.type === 'lead-form') && c.styles?.verticalAlign === 'bottom');
    this.elements.contentArea.style.justifyContent = hasBottomComponent ? 'flex-start' : 'center';
    this.components.forEach(c => {
        const wrapper = document.createElement('div');
        wrapper.className = 'preview-wrapper'; wrapper.dataset.id = c.id;
        if (c.id === this.activeComponentId) wrapper.classList.add('selected');
        wrapper.onclick = (e) => { e.stopPropagation(); this.selectComponent(c.id); };
        if (c.type !== 'lead-form') { wrapper.style.textAlign = c.styles?.textAlign || 'center'; }
        if ((c.type === 'button' || c.type === 'lead-form') && c.styles?.verticalAlign === 'bottom') { wrapper.style.marginTop = 'auto'; }
        let element;
        switch(c.type) {
            case 'heading': element = document.createElement('h1'); element.textContent = c.content; break;
            case 'paragraph': element = document.createElement('p'); element.textContent = c.content; break;
            case 'button': element = document.createElement('button'); element.textContent = c.content; break;
            case 'lead-form':
                element = document.createElement('form'); element.className = 'component-content';
                let formHTML = (this.allPossibleFormFields.filter(field => c.activeFields?.includes(field.name)) || [])
                    .map(field => `<div style="margin-bottom: 8px;"><input type="${field.type}" name="${field.name}" placeholder="${field.placeholder}" required style="width: 100%; padding: 10px; border-radius: 4px; border: 1px solid var(--border-color); background-color: var(--input-bg); color: var(--text-color);"></div>`).join('');
                if (c.privacy?.enabled) { formHTML += `<div style="margin-top: 10px; margin-bottom: 15px; text-align: left; display: flex; align-items: center; gap: 8px;"><input type="checkbox" id="privacy-preview-${c.id}" style="width: auto; height: 16px; margin: 0;"><label for="privacy-preview-${c.id}" style="font-size: 12px; color: #94a3b8; font-weight: normal; cursor: pointer;">${c.privacy.text}</label></div>`; }
                formHTML += `<button type="submit" style="width: 100%; padding: 12px; border: none; border-radius: 4px; background-color: ${c.styles?.submitButtonColor || '#1877f2'}; color: white; font-size: 16px; cursor: pointer;">${c.submitText || '제출'}</button>`;
                element.innerHTML = formHTML; element.onsubmit = (e) => e.preventDefault();
                break;
        }
        if (c.type !== 'lead-form') element.className = 'component-content';
        const { textAlign, verticalAlign, backgroundColor, backgroundColorOpacity, ...otherStyles } = c.styles || {};
        Object.assign(element.style, otherStyles);
        if (c.type === 'button') { element.style.backgroundColor = this.hexToRgba(backgroundColor || '#1877f2', backgroundColorOpacity); } 
        else if (c.type === 'lead-form' && backgroundColor) { element.style.backgroundColor = backgroundColor; }
        wrapper.appendChild(element);
        this.elements.contentArea.appendChild(wrapper);
    });
  },
  renderControls() {
      this.elements.pageBgColorInput.value = this.pageSettings.bgColor || '#DCEAF7';
      this.elements.pageBackgroundImageInput.value = this.pageSettings.bgImage || '';
      this.elements.pageBackgroundVideoInput.value = this.pageSettings.bgVideo || '';
      this.elements.editorsContainer.innerHTML = '';
      this.components.forEach((c) => {
          const panel = document.createElement('div');
          panel.className = 'editor-panel'; panel.dataset.id = c.id;
          const handle = document.createElement('h4');
          handle.innerHTML = `${{ heading: '제목', paragraph: '내용', button: '버튼', 'lead-form': '고객 정보' }[c.type]} 블록 <div class="panel-controls"><button class="delete-btn" title="삭제">✖</button></div>`;
          if (c.id === this.activeComponentId) panel.classList.add('selected');
          let panelContentHTML = '';
          if (c.type === 'lead-form') {
              let checklistHTML = '<div class="control-group"><label>📋 포함할 정보 항목</label><div class="form-fields-checklist" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background-color: #334155; padding: 10px; border-radius: 6px;">';
              this.allPossibleFormFields.forEach(field => { const isChecked = c.activeFields?.includes(field.name); checklistHTML += `<div class="inline-group" style="margin-bottom: 0;"><label for="field-${c.id}-${field.name}" style="font-weight: normal; cursor: pointer;">${field.label}</label><input type="checkbox" id="field-${c.id}-${field.name}" data-control-type="field-toggle" data-field-name="${field.name}" ${isChecked ? 'checked' : ''} style="width: auto; cursor: pointer;"></div>`; });
              checklistHTML += '</div></div>';
              const privacy = c.privacy || { enabled: false, text: '' }; 
              const privacySettingsHTML = `<div class="control-group" style="background-color: #334155; padding: 10px; border-radius: 6px;"><div class="inline-group"><label for="privacy-enabled-${c.id}" style="cursor: pointer;">🔒 개인정보 수집 동의</label><input type="checkbox" id="privacy-enabled-${c.id}" data-control-type="privacy-toggle" ${privacy.enabled ? 'checked' : ''} style="width: auto; cursor: pointer;"></div>${privacy.enabled ? `<div class="control-group" style="margin-top: 10px; margin-bottom: 0;"><label>동의 문구</label><textarea data-prop="privacy.text" style="height: 60px;">${privacy.text}</textarea></div>` : ''}</div>`;
              panelContentHTML = `${checklistHTML}<div class="control-group"><label>📝 구글 스크립트 URL</label><textarea data-prop="googleScriptUrl" placeholder="배포된 구글 웹 앱 URL" style="height: 80px;">${c.googleScriptUrl || ''}</textarea></div><div class="control-group"><label>✅ 제출 버튼 텍스트</label><input type="text" data-prop="submitText" value="${c.submitText || ''}"></div><div class="control-group"><label>🎉 성공 메시지</label><input type="text" data-prop="successMessage" value="${c.successMessage || ''}"></div><div class="control-group inline-group"><label>버튼 색상</label><input type="text" data-color-picker data-style="submitButtonColor" value="${c.styles?.submitButtonColor || '#1877f2'}"></div>${privacySettingsHTML}`;
          } else {
              let contentHTML = `<div class="control-group"><label>내용</label><textarea data-prop="content">${c.content}</textarea></div>`;
              if (c.type === 'button') { contentHTML += `<div class="control-group"><label>🔗 링크 URL</label><input type="text" data-prop="link" value="${c.link || ''}" placeholder="https://example.com"></div>`; }
              let fontSelectorHTML = `<div class="control-group"><label>글꼴</label><select data-style="fontFamily"><option value="'Noto Sans KR', sans-serif">깔끔 고딕체</option><option value="'Nanum Myeongjo', serif">부드러운 명조체</option><option value="'Gaegu', cursive">귀여운 손글씨체</option></select></div>`;
              let styleGridHTML = '<div class="style-grid">';
              styleGridHTML += `<div class="control-group"><label>정렬</label><select data-style="textAlign"><option value="left">왼쪽</option><option value="center">가운데</option><option value="right">오른쪽</option></select></div>`;
              styleGridHTML += `<div class="control-group"><label>글자색</label><input type="text" data-color-picker data-style="color" value="${c.styles?.color || '#FFFFFF'}"></div>`;
              styleGridHTML += `<div class="control-group"><label>글자 크기</label><input type="text" data-style="fontSize" value="${(c.styles?.fontSize || '').replace('px','')}" placeholder="24"></div>`;
              styleGridHTML += '</div>';
              let buttonBgColorHTML = '';
              if(c.type === 'button') {
                  buttonBgColorHTML = `<div class="control-group inline-group"><label>버튼 배경색</label><input type="text" data-color-picker data-style="backgroundColor" value="${c.styles?.backgroundColor || '#1877f2'}"></div>`;
              }
              panelContentHTML = contentHTML + fontSelectorHTML + styleGridHTML + buttonBgColorHTML;
          }
          const contentDiv = document.createElement('div');
          contentDiv.innerHTML = panelContentHTML;
          panel.appendChild(handle);
          panel.appendChild(contentDiv);
          this.elements.editorsContainer.appendChild(panel);
          if (c.type !== 'lead-form') {
              const textAlignSelect = panel.querySelector('[data-style="textAlign"]'); if(textAlignSelect) textAlignSelect.value = c.styles?.textAlign || 'center';
              const fontFamilySelect = panel.querySelector('[data-style="fontFamily"]'); if(fontFamilySelect) fontFamilySelect.value = c.styles?.fontFamily || "'Noto Sans KR', sans-serif";
          }
      });
      this.attachEventListenersToControls();
  },
  renderViewportControls() {
      this.elements.viewportControlsLeft.innerHTML = '';
      const btnGroup = document.createElement('div'); btnGroup.className = 'viewport-controls';
      this.viewportOptions.forEach(opt => {
          const btn = document.createElement('button');
          btn.className = 'viewport-btn';
          btn.dataset.value = opt.value;
          btn.title = opt.title;
          btn.innerHTML = opt.label;
          if (this.pageSettings.viewport === opt.value) btn.classList.add('active');
          btn.onclick = () => {
              this.pageSettings.viewport = opt.value;
              this.saveAndRender(false, true);
              this.renderViewportControls();
          };
          btnGroup.appendChild(btn);
      });
      this.elements.viewportControlsLeft.appendChild(btnGroup);
  },
  attachEventListenersToControls() {
    this.elements.editorsContainer.querySelectorAll('.editor-panel').forEach(panel => {
        const id = Number(panel.dataset.id);
        panel.addEventListener('click', (e) => {
            if (e.target.closest('.control-group') || e.target.closest('.panel-controls')) return;
            this.selectComponent(id);
        });
        panel.querySelectorAll('[data-prop]').forEach(input => { 
            input.oninput = (e) => this.updateComponent(id, e.target.dataset.prop, e.target.value, false); 
        });
        panel.querySelectorAll('[data-style]').forEach(input => {
            input.oninput = (e) => {
                let value = e.target.value;
                if (e.target.dataset.style === 'fontSize' && value.trim() !== '' && !isNaN(value.trim())) value += 'px';
                this.updateComponent(id, `styles.${e.target.dataset.style}`, value, false);
            };
        });
        panel.querySelectorAll('[data-control-type="field-toggle"]').forEach(checkbox => {
            checkbox.onchange = () => {
                const fieldName = checkbox.dataset.fieldName;
                const component = this.components.find(c => c.id === id);
                if (!component) return;
                if (!component.activeFields) component.activeFields = [];
                if (checkbox.checked) { if (!component.activeFields.includes(fieldName)) component.activeFields.push(fieldName); } 
                else { component.activeFields = component.activeFields.filter(name => name !== fieldName); }
                this.saveAndRender(true, true);
            };
        });
        panel.querySelector('[data-control-type="privacy-toggle"]')?.addEventListener('change', (e) => {
            this.updateComponent(id, 'privacy.enabled', e.target.checked, true);
        });
        panel.querySelector('.delete-btn').onclick = () => this.deleteComponent(id);
    });
  },
  initSortable() {
      if (this.sortableInstance) this.sortableInstance.destroy();
      this.sortableInstance = new Sortable(this.elements.editorsContainer, {
          handle: 'h4', animation: 150, ghostClass: 'sortable-ghost',
          onEnd: (evt) => {
              if (evt.oldIndex === evt.newIndex) return;
              const item = this.components.splice(evt.oldIndex, 1)[0];
              this.components.splice(evt.newIndex, 0, item);
              this.saveAndRender(false, true);
          },
      });
  },
  selectComponent(id) { this.activeComponentId = id; this.renderControls(); this.renderPreview(); },
  addComponent(type) {
      const newComponent = { id: Date.now(), type, styles: { fontFamily: "'Noto Sans KR', sans-serif" } };
      switch(type) {
          case 'heading': newComponent.content = 'Welcome to My Page'; newComponent.styles = {...newComponent.styles, textAlign: 'center', color: '#FFFFFF', fontSize: '48px'}; break;
          case 'paragraph': newComponent.content = 'This is a beautiful landing page.'; newComponent.styles = {...newComponent.styles, textAlign: 'center', color: '#FFFFFF', fontSize: '20px'}; break;
          case 'button': newComponent.content = 'Explore'; newComponent.link = ''; newComponent.styles = {...newComponent.styles, backgroundColor: '#1877f2', color: '#ffffff', padding: '12px 25px', border: 'none', borderRadius: '8px', backgroundColorOpacity: 1 }; break;
          case 'lead-form': newComponent.googleScriptUrl = ''; newComponent.submitText = '문의 남기기'; newComponent.successMessage = '성공적으로 제출되었습니다. 감사합니다!'; newComponent.activeFields = ['name', 'email']; newComponent.styles = { padding: '25px', borderRadius: '8px', backgroundColor: 'transparent', submitButtonColor: '#1877f2' }; newComponent.privacy = { enabled: true, text: '(필수) 개인정보 수집 및 이용에 동의합니다.' }; break;
      }
      this.components.push(newComponent);
      this.activeComponentId = newComponent.id;
      this.saveAndRender(true, true);
  },
  updateComponent(id, keyPath, value, rerenderControls = false) {
      let component = this.components.find(c => c.id === id);
      if (!component) return;
      const keys = keyPath.split('.');
      let current = component;
      for (let i = 0; i < keys.length - 1; i++) {
          if (!current[keys[i]]) current[keys[i]] = {};
          current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      this.saveAndRender(rerenderControls, true);
  },
  deleteComponent(id) {
      if (!confirm('블록을 삭제하시겠습니까?')) return;
      this.components = this.components.filter(c => c.id !== id);
      if (this.activeComponentId === id) this.activeComponentId = null;
      this.saveAndRender(true, true);
  },
  async saveAndRender(rerenderControls = true, rerenderPreview = true) {
      if (rerenderPreview) this.renderPreview();
      if (rerenderControls) { this.renderControls(); this.renderViewportControls(); this.initSortable(); }
      try {
          const docRef = doc(db, "pages", this.currentPageId);
          await updateDoc(docRef, { components: this.components, pageSettings: this.pageSettings, updatedAt: serverTimestamp() });
      } catch (error) { console.error("자동 저장 실패:", error); }
  }
};

// ===============================================================
// 🚀 Content Card Logic (v1.2 - Final Debug Version)
// ===============================================================
const cards = {
  list: [], editingId: null, selectedMediaFile: null, currentMediaUrl: '', currentMediaType: 'image',
  currentUploadTask: null, tempPreviewUrl: null, ui: {}, isInitialized: false,
  
  init() {
    if (this.isInitialized) return;
    this.collection = collection(db, "ads");
    this.listen();
    this.initSortable();
    this.isInitialized = true;
  },
  mapUI() {
      this.ui = {
          adListContainer: document.getElementById('ad-list-container'),
          adModal: document.getElementById('ad-modal'),
          modalTitle: document.getElementById('modal-title'),
          closeModalButton: document.getElementById('close-modal-button'),
          adTitleInput: document.getElementById('ad-title'),
          adDescriptionInput: document.getElementById('ad-description'),
          isPartnersCheckbox: document.getElementById('is-partners-checkbox'),
          adLinkInput: document.getElementById('ad-link'),
          adStartDateInput: document.getElementById('ad-start-date'),
          adEndDateInput: document.getElementById('ad-end-date'),
          adMediaFileInput: document.getElementById('ad-media-file'),
          saveAdButton: document.getElementById('save-ad-button'),
          adPreview: document.getElementById('ad-preview'),
          mediaUploadStatus: document.getElementById('media-upload-status'),
          uploadLabel: document.getElementById('upload-label'),
          uploadProgress: document.getElementById('upload-progress'),
          progressBarFill: document.getElementById('progress-bar-fill'),
          fileNameDisplay: document.getElementById('file-name-display'),
          iframeAdModal: document.getElementById('iframe-ad-modal'),
          iframeModalTitle: document.getElementById('iframe-modal-title'),
          closeIframeModalButton: document.getElementById('close-iframe-modal-button'),
          iframeAdTitleInput: document.getElementById('iframe-ad-title'),
          iframeAdCodeInput: document.getElementById('iframe-ad-code'),
          iframeIsPartnersCheckbox: document.getElementById('iframe-is-partners-checkbox'),
          iframeAdStartDateInput: document.getElementById('iframe-ad-start-date'),
          iframeAdEndDateInput: document.getElementById('iframe-ad-end-date'),
          saveIframeAdButton: document.getElementById('save-iframe-ad-button'),
      };
  },
  addEventListeners() {
      if (this.ui.closeModalButton) this.ui.closeModalButton.addEventListener('click', () => this.ui.adModal.classList.remove('active'));
      if (this.ui.saveAdButton) this.ui.saveAdButton.addEventListener('click', this.handleSaveAd.bind(this));
      [this.ui.adTitleInput, this.ui.adDescriptionInput, this.ui.adLinkInput, this.ui.isPartnersCheckbox].forEach(input => {
          if (input) input.addEventListener('input', () => this.updatePreview());
      });
      if (this.ui.adMediaFileInput) this.ui.adMediaFileInput.addEventListener('change', this.handleFileUpload.bind(this));
      if (this.ui.closeIframeModalButton) this.ui.closeIframeModalButton.addEventListener('click', () => this.ui.iframeAdModal.classList.remove('active'));
      if (this.ui.saveIframeAdButton) this.ui.saveIframeAdButton.addEventListener('click', this.handleSaveIframeAd.bind(this));
  },
  listen() {
      const q = query(this.collection, orderBy("order", "asc"));
      onSnapshot(q, (querySnapshot) => {
          this.list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const cardsView = document.getElementById('cards-view');
          if (ui.dashboardContainer && !ui.dashboardContainer.classList.contains('hidden') && cardsView && !cardsView.classList.contains('hidden')) {
              this.render();
          }
      });
  },
  initSortable() {
    // ... 이전과 동일 ...
  },
  getAdStatus(ad) {
    // ... 이전과 동일 ...
  },
  formatDateTime(dateTimeString) {
    // ... 이전과 동일 ...
  },
  render() {
    if(!this.ui.adListContainer) return;
    this.ui.adListContainer.innerHTML = '';
    if (this.list.length === 0) {
        this.ui.adListContainer.innerHTML = `<p class="text-center text-slate-500 py-8">등록된 카드가 없습니다.</p>`;
        return;
    }
    this.list.forEach((ad) => {
        const adElement = document.createElement('div');
        adElement.className = `bg-slate-800 rounded-xl shadow-md transition-opacity ${ad.isActive === false ? 'opacity-40' : ''}`;
        adElement.dataset.id = ad.id;
        const isIframe = ad.adType === 'iframe';
        const mediaIcon = isIframe 
          ? `<div class="w-12 h-12 flex-shrink-0 bg-indigo-900 text-indigo-400 rounded-lg flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg></div>` 
          : (ad.mediaType === 'video' 
              ? `<div class="w-12 h-12 flex-shrink-0 bg-rose-900 text-rose-400 rounded-lg flex items-center justify-center text-2xl">🎬</div>` 
              : `<div class="w-12 h-12 flex-shrink-0 bg-sky-900 text-sky-400 rounded-lg flex items-center justify-center text-2xl">🖼️</div>`);
        const clickCount = ad.clickCount || 0;
        const statusBadge = this.getAdStatus(ad);
        const periodText = (ad.startDate || ad.endDate) 
          ? `${this.formatDateTime(ad.startDate)} ~ ${this.formatDateTime(ad.endDate)}`
          : '항상 게시';
        const isChecked = ad.isActive !== false ? 'checked' : '';
        adElement.innerHTML = `
          <div class="p-4 flex items-start gap-4">
              <div class="drag-handle text-slate-500 pt-3 hidden sm:block"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg></div>
              ${mediaIcon}
              <div class="flex-grow overflow-hidden">
                  <p class="font-bold text-slate-100 truncate">${ad.title}</p>
                  <div class="flex items-center text-sm text-slate-400 mt-1 gap-2">
                      ${statusBadge}
                      <span class="text-slate-600">|</span>
                      <div class="flex items-center ${isIframe ? 'hidden' : ''}" title="클릭 수">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                          <span>${clickCount}</span>
                      </div>
                  </div>
                  <div class="text-xs text-slate-500 mt-2">${periodText}</div>
              </div>
              <div class="flex-shrink-0">
                  <label class="toggle-switch">
                      <input type="checkbox" class="ad-status-toggle" data-id="${ad.id}" ${isChecked}>
                      <span class="toggle-slider"></span>
                  </label>
              </div>
          </div>
          <div class="border-t border-slate-700 p-2 flex justify-end gap-2">
              <button class="edit-ad-button text-sm font-medium text-emerald-400 hover:bg-slate-700 px-4 py-2 rounded-md" data-id="${ad.id}">수정</button>
              <button class="delete-ad-button text-sm font-medium text-red-400 hover:bg-slate-700 px-4 py-2 rounded-md" data-id="${ad.id}">삭제</button>
          </div>
        `;
        if(this.ui.adListContainer) this.ui.adListContainer.appendChild(adElement);
    });

    document.querySelectorAll('.edit-ad-button').forEach(btn => btn.addEventListener('click', this.handleEditAd.bind(this)));
    document.querySelectorAll('.delete-ad-button').forEach(btn => btn.addEventListener('click', this.handleDeleteAd.bind(this)));
    document.querySelectorAll('.ad-status-toggle').forEach(toggle => toggle.addEventListener('change', this.handleToggleAdStatus.bind(this)));
  },
  async handleToggleAdStatus(event) {
    // ... 이전과 동일 ...
  },
  handleFileUpload(event) {
    // ... 이전과 동일 ...
  },
  resetCardModalState() {
    // ... 이전과 동일 ...
  },
  handleAddNewAd() {
      console.log("handleAddNewAd 함수 호출됨"); // ◀◀◀ 디버깅 로그
      this.editingId = null; this.selectedMediaFile = null; this.currentMediaUrl = ''; this.currentMediaType = 'image';
      if (this.ui.modalTitle) this.ui.modalTitle.textContent = "새 미디어 카드";
      this.resetCardModalState(); this.updatePreview();
      if (this.ui.adModal) this.ui.adModal.classList.add('active');
  },
  resetIframeModalState() {
    // ... 이전과 동일 ...
  },
  handleAddNewIframeAd() {
      console.log("handleAddNewIframeAd 함수 호출됨"); // ◀◀◀ 디버깅 로그
      this.editingId = null;
      if (this.ui.iframeModalTitle) this.ui.iframeModalTitle.textContent = "새 iframe 카드";
      this.resetIframeModalState();
      if (this.ui.iframeAdModal) this.ui.iframeAdModal.classList.add('active');
  },
  handleEditAd(event) {
      console.log("handleEditAd 함수 호출됨", event.target.dataset.id); // ◀◀◀ 디버깅 로그
      this.editingId = event.target.dataset.id;
      const ad = this.list.find(ad => ad.id === this.editingId);
      if (!ad) return;
      if (ad.adType === 'iframe') {
          this.resetIframeModalState();
          if (this.ui.iframeModalTitle) this.ui.iframeModalTitle.textContent = "iframe 카드 수정";
          if (this.ui.iframeAdTitleInput) this.ui.iframeAdTitleInput.value = ad.title;
          if (this.ui.iframeAdCodeInput) this.ui.iframeAdCodeInput.value = ad.iframeCode || '';
          if (this.ui.iframeIsPartnersCheckbox) this.ui.iframeIsPartnersCheckbox.checked = ad.isPartners || false;
          if (this.ui.iframeAdStartDateInput) this.ui.iframeAdStartDateInput.value = ad.startDate || '';
          if (this.ui.iframeAdEndDateInput) this.ui.iframeAdEndDateInput.value = ad.endDate || '';
          if (this.ui.iframeAdModal) this.ui.iframeAdModal.classList.add('active');
      } else {
          this.resetCardModalState();
          this.selectedMediaFile = null;
          this.currentMediaUrl = ad.mediaUrl || ''; this.currentMediaType = ad.mediaType || 'image';
          if (this.ui.modalTitle) this.ui.modalTitle.textContent = "미디어 카드 수정";
          if (this.ui.adTitleInput) this.ui.adTitleInput.value = ad.title;
          if (this.ui.adDescriptionInput) this.ui.adDescriptionInput.value = ad.description || '';
          if (this.ui.adLinkInput) this.ui.adLinkInput.value = ad.link || '';
          if (this.ui.isPartnersCheckbox) this.ui.isPartnersCheckbox.checked = ad.isPartners || false;
          if (this.ui.adStartDateInput) this.ui.adStartDateInput.value = ad.startDate || '';
          if (this.ui.adEndDateInput) this.ui.adEndDateInput.value = ad.endDate || '';
          if (this.ui.fileNameDisplay) this.ui.fileNameDisplay.textContent = ad.mediaUrl ? '기존 파일 유지' : '선택된 파일 없음';
          this.updatePreview();
          if (this.ui.adModal) this.ui.adModal.classList.add('active');
      }
  },
  async handleDeleteAd(event) {
    // ... 이전과 동일 ...
  },
  async uploadMediaFile() {
    // ... 이전과 동일 ...
  },
  async handleSaveAd() {
    // ... 이전과 동일 ...
  },
  async handleSaveIframeAd() {
    // ... 이전과 동일 ...
  },
  updatePreview() {
    // ... 이전과 동일 ...
  },
};

// --- 6. 앱 실행 ---
// js/main.js 의 가장 마지막 부분

// 1. 기존의 addEventListener 라인을 삭제합니다.
// document.addEventListener('DOMContentLoaded', initializeAppAndAuth);

// 2. initializeAppAndAuth 함수를 외부에서 사용할 수 있도록 export 합니다.
export { initializeAppAndAuth };