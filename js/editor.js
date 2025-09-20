// js/editor.js (v2.13 - 통합 미디어 업로드 기능)

import { doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";
import { ui, showToast } from './ui.js';
import { pagesList } from './pages.js';
import { navigateTo } from './navigation.js';
import { firebaseReady, getFirestoreDB, getFirebaseStorage } from './firebase.js';

export const editor = {
    currentPageId: null, 
    components: [], 
    pageSettings: {}, 
    activeComponentId: null, 
    sortableInstance: null, 
    elements: {},
    selectedBgMediaFile: null,
    viewportOptions: [
        { id: 'mobile',  label: '🤳', value: '375px,667px',  title: '모바일' },
        { id: 'tablet',  label: '📱', value: '768px,1024px', title: '태블릿' },
        { id: 'desktop', label: '🖥️', value: '1280px,800px', title: '데스크탑' },
        { id: 'full',    label: '전체', value: '100%,100%',   title: '전체 화면' }
    ],
    allPossibleFormFields: [ 
        { name: 'name', label: '이름', type: 'text', placeholder: '이름을 입력하세요' }, 
        { name: 'email', label: '이메일', type: 'email', placeholder: '이메일 주소를 입력하세요' }, 
        { name: 'phone', label: '전화번호', type: 'tel', placeholder: '전화번호를 입력하세요' }, 
        { name: 'birthdate', label: '생년월일', type: 'date', placeholder: '' }, 
        { name: 'gender', label: '성별', type: 'text', placeholder: '성별을 입력하세요' } 
    ],

    async init(pageId) {
        await firebaseReady;
        this.currentPageId = pageId;
        const editorView = document.getElementById('editor-view');
        if (!editorView) return;
        
        editorView.innerHTML = `
        <div class="editor-main-container">
            <div id="editor-controls-wrapper"><div class="editor-control-panel">
                <div class="control-group"><button id="back-to-list-btn" style="background-color: #475569; color: white;">← 목록으로 돌아가기</button></div>
                <h3>- 콘텐츠 블록 추가 -</h3>
                <div class="control-group component-adders" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <button data-type="heading">➕ 제목</button>
                    <button data-type="paragraph">➕ 내용</button>
                    <button data-type="button">➕ 버튼</button>
                    <button data-type="lead-form">➕ 고객 정보</button>
                    <button data-type="scene" style="grid-column: 1 / -1; background-color: #be185d;">✨ ➕ 장면 (스토리용)</button>
                </div>
                <hr style="border-color: var(--border-color); margin: 20px 0;">
                <div id="page-background-controls">
                    <h3>- 페이지 배경 -</h3>
                    <div class="control-group inline-group"><label for="page-bg-color">배경색</label><input type="text" data-color-picker id="page-bg-color"></div>
                    <div class="control-group">
                        <label>배경 미디어 (이미지/동영상)</label>
                        <div class="flex items-center gap-4">
                            <label for="page-media-file" class="file-input-button">파일 선택</label>
                            <span id="page-file-name-display" class="text-sm text-slate-500 truncate">선택된 파일 없음</span>
                        </div>
                        <input type="file" id="page-media-file" accept="image/png, image/jpeg, image/gif, video/mp4, video/webm" class="file-input-hidden">
                        <p class="mt-1 text-xs text-slate-500">동영상은 자동으로 썸네일이 생성됩니다.</p>
                        <div id="page-media-upload-status" class="mt-2 space-y-1 opacity-0">
                            <div class="flex justify-between text-xs font-semibold text-emerald-400">
                                <span>업로드 중...</span><span id="page-upload-progress">0%</span>
                            </div>
                            <div class="progress-bar"><div id="page-progress-bar-fill" class="progress-bar-fill"></div></div>
                        </div>
                    </div>
                </div>
                <hr style="border-color: var(--border-color); margin: 20px 0;">
                <div id="editors-container"></div>
            </div></div>
            <div id="editor-preview-container" class="bg-slate-800"><div class="editor-control-panel" style="display: flex; flex-direction: column; height: 100%;">
                <div id="viewport-controls-left"></div> <div id="editor-preview-wrapper"><div id="editor-preview"><video class="background-video" autoplay loop muted playsinline></video><div class="background-image-overlay"></div><div class="content-area"></div></div></div>
            </div></div>
        </div>`;

        this.elements = {
            preview: editorView.querySelector('#editor-preview'), contentArea: editorView.querySelector('.content-area'),
            backgroundImageOverlay: editorView.querySelector('.background-image-overlay'), backgroundVideo: editorView.querySelector('.background-video'),
            editorsContainer: editorView.querySelector('#editors-container'), adders: editorView.querySelectorAll('.component-adders button'),
            pageBgColorInput: editorView.querySelector('#page-bg-color'),
            viewportControlsLeft: editorView.querySelector('#viewport-controls-left'),
            backToListBtn: editorView.querySelector('#back-to-list-btn'),
            pageBackgroundControls: editorView.querySelector('#page-background-controls'),
            pageMediaFileInput: editorView.querySelector('#page-media-file'),
            pageFileNameDisplay: editorView.querySelector('#page-file-name-display'),
            pageMediaUploadStatus: editorView.querySelector('#page-media-upload-status'),
            pageUploadProgress: editorView.querySelector('#page-upload-progress'),
            pageProgressBarFill: editorView.querySelector('#page-progress-bar-fill'),
        };

        await this.loadProject();
        this.setupEventListeners();
    },

    async uploadPageMediaFile() {
        if (!this.selectedBgMediaFile || !this.currentPageId) return null;

        const storage = getFirebaseStorage();
        const originalFileName = this.selectedBgMediaFile.name;
        const fileExtension = originalFileName.split('.').pop();
        const isVideo = this.selectedBgMediaFile.type.startsWith('video/');
        const folder = isVideo ? 'page_videos' : 'page_images';
        
        const fileName = `pages---${this.currentPageId}---${Date.now()}.${fileExtension}`;
        
        const storageRef = ref(storage, `${folder}/${fileName}`);
        
        this.elements.pageMediaUploadStatus.style.opacity = 1;

        return new Promise((resolve, reject) => {
            const uploadTask = uploadBytesResumable(storageRef, this.selectedBgMediaFile);
            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    this.elements.pageUploadProgress.textContent = `${Math.round(progress)}%`;
                    this.elements.pageProgressBarFill.style.width = `${progress}%`;
                },
                (error) => {
                    console.error("Upload failed:", error);
                    showToast("미디어 업로드 실패.", "error");
                    this.elements.pageMediaUploadStatus.style.opacity = 0;
                    reject(error);
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    showToast("미디어 업로드 성공!");
                    this.elements.pageMediaUploadStatus.style.opacity = 0;
                    resolve({ url: downloadURL, isVideo: isVideo });
                }
            );
        });
    },

    async handlePageFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.selectedBgMediaFile = file;
        this.elements.pageFileNameDisplay.textContent = file.name;

        const storage = getFirebaseStorage();
        if (this.pageSettings.bgVideo) {
             try { await deleteObject(ref(storage, this.pageSettings.bgVideo)); } catch(e) { console.warn("Could not delete old video", e); }
        }
        if (this.pageSettings.bgImage) {
             try { await deleteObject(ref(storage, this.pageSettings.bgImage)); } catch(e) { console.warn("Could not delete old image", e); }
        }
        if (this.pageSettings.thumbnailUrl) {
             try { await deleteObject(ref(storage, this.pageSettings.thumbnailUrl)); } catch(e) { console.warn("Could not delete old thumbnail", e); }
        }
        
        const uploadResult = await this.uploadPageMediaFile();
        if (uploadResult) {
            if (uploadResult.isVideo) {
                this.pageSettings.bgVideo = uploadResult.url;
                this.pageSettings.bgImage = ''; 
                delete this.pageSettings.thumbnailUrl;
            } else {
                this.pageSettings.bgImage = uploadResult.url;
                this.pageSettings.bgVideo = '';
                delete this.pageSettings.thumbnailUrl;
            }
            this.selectedBgMediaFile = null;
            await this.saveAndRender(false, true);
        }
    },

    setupEventListeners() {
        this.elements.adders.forEach(button => button.addEventListener('click', () => this.addComponent(button.dataset.type)));
        this.elements.pageBgColorInput.addEventListener('change', (e) => { this.pageSettings.bgColor = e.target.value; this.saveAndRender(false, true); });
        
        this.elements.pageMediaFileInput.addEventListener('change', this.handlePageFileUpload.bind(this));

        this.elements.backToListBtn.addEventListener('click', () => navigateTo('pages'));
        if (ui.viewTitle) {
            ui.viewTitle.addEventListener('blur', () => this.handleTitleUpdate());
            ui.viewTitle.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); ui.viewTitle.blur(); }
            });
        }
        document.addEventListener('color', this.handleColorRealtimeUpdate.bind(this));
    },

    async loadProject() {
        await firebaseReady;
        const db = getFirestoreDB();
        const docRef = doc(db, "pages", this.currentPageId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            this.components = data.components || [];
            this.pageSettings = data.pageSettings || { viewport: '375px,667px' };
            const pageTitle = data.name || '페이지';
            if (ui.viewTitle) {
                ui.viewTitle.textContent = pageTitle;
                ui.viewTitle.setAttribute('contenteditable', 'true');
                ui.viewTitle.setAttribute('data-original-title', pageTitle);
            }
        } else { navigateTo('pages'); }
        this.renderAll();
    },

    handleColorRealtimeUpdate(event) {
        const input = event.detail.input;
        const color = event.detail.color;
        if (!input.hasAttribute('data-color-picker')) return;

        if (input.id === 'page-bg-color') {
            this.pageSettings.bgColor = color;
        } else {
            const panel = input.closest('.editor-panel');
            if (!panel) return;

            const id = Number(panel.dataset.id);
            const component = this.components.find(c => c.id === id);
            if (component) {
                if (input.dataset.style) {
                    if (component.styles) {
                        component.styles[input.dataset.style] = color;
                    }
                } else if (input.dataset.sceneProp) {
                    if (component.sceneSettings) {
                        component.sceneSettings[input.dataset.sceneProp] = color;
                    }
                } else if (input.dataset.sceneInnerStyle) {
                    const [index, key] = input.dataset.sceneInnerStyle.split('.');
                    if (component.components?.[index]?.styles) {
                        component.components[index].styles[key] = color;
                    }
                }
            }
        }
        this.renderPreview();
    },

    async handleTitleUpdate() {
        await firebaseReady;
        const db = getFirestoreDB();
        const newTitle = ui.viewTitle.textContent.trim();
        const originalTitle = ui.viewTitle.dataset.originalTitle;
        if (!newTitle) { alert('제목은 비워둘 수 없습니다.'); ui.viewTitle.textContent = originalTitle; return; }
        if (newTitle === originalTitle) return;
        try {
            const docRef = doc(db, "pages", this.currentPageId);
            await updateDoc(docRef, { name: newTitle });
            ui.viewTitle.dataset.originalTitle = newTitle;
            const pageInList = pagesList.find(p => p.id === this.currentPageId);
            if(pageInList) pageInList.name = newTitle;
        } catch (error) { console.error("페이지 제목 업데이트 실패:", error); alert("제목 업데이트에 실패했습니다."); ui.viewTitle.textContent = originalTitle; }
    },

    renderAll() {
        this.renderPreview();
        this.renderControls();
        this.renderViewportControls();
        this.initSortable();
    },

    hexToRgba(hex, alpha = 1) { if (!/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) return hex; let c = hex.substring(1).split(''); if (c.length === 3) { c = [c[0], c[0], c[1], c[1], c[2], c[2]]; } c = '0x' + c.join(''); return `rgba(${[(c>>16)&255, (c>>8)&255, c&255].join(',')},${alpha})`; },

    renderPreview() {
        if (!this.elements.contentArea) return;
        this.elements.contentArea.innerHTML = '';
        const { viewport, bgVideo, bgImage, bgColor } = this.pageSettings;
        const [width, height] = (viewport || '375px,667px').split(',');
        this.elements.preview.style.width = width;
        this.elements.preview.style.height = height;

        if (bgVideo) {
            this.elements.backgroundVideo.src = bgVideo;
            this.elements.backgroundVideo.style.display = 'block';
            this.elements.backgroundImageOverlay.style.display = 'none';
            this.elements.preview.style.backgroundColor = 'transparent';
        } else if (bgImage) {
            this.elements.backgroundVideo.style.display = 'none';
            this.elements.backgroundImageOverlay.style.backgroundImage = `url('${bgImage}')`;
            this.elements.backgroundImageOverlay.style.display = 'block';
            this.elements.preview.style.backgroundColor = 'transparent';
        } else {
            this.elements.backgroundVideo.style.display = 'none';
            this.elements.backgroundImageOverlay.style.display = 'none';
            this.elements.preview.style.backgroundColor = bgColor;
        }

        const isStoryPage = this.components.some(c => c.type === 'scene');
        if (isStoryPage) {
            this.elements.contentArea.style.justifyContent = 'center';
            const activeScene = this.components.find(c => c.id === this.activeComponentId && c.type === 'scene') || this.components.find(c => c.type === 'scene');
            if (activeScene) {
                const wrapper = document.createElement('div');
                wrapper.className = 'preview-wrapper scene-preview-active';
                const sceneBgImage = activeScene.sceneSettings?.bgImage;
                const sceneBgColor = activeScene.sceneSettings?.bgColor || '#000';
                wrapper.style.cssText = `background-color: ${sceneBgColor}; ${sceneBgImage ? `background-image: url('${sceneBgImage}');` : ''} background-size: cover; background-position: center;`;
                (activeScene.components || []).forEach(innerComp => {
                    let element;
                    switch(innerComp.type) { case 'heading': element = document.createElement('h1'); break; case 'paragraph': element = document.createElement('p'); break; case 'button': element = document.createElement('button'); break; default: element = document.createElement('div'); }
                    element.textContent = innerComp.content;
                    Object.assign(element.style, innerComp.styles);
                    wrapper.appendChild(element);
                });
                this.elements.contentArea.appendChild(wrapper);
            }
        } else {
            const hasBottomComponent = this.components.some(c => (c.type === 'button' || c.type === 'lead-form') && c.styles?.verticalAlign === 'bottom');
            this.elements.contentArea.style.justifyContent = hasBottomComponent ? 'flex-start' : 'center';
            this.components.forEach(c => {
                 const wrapper = document.createElement('div'); wrapper.className = 'preview-wrapper'; wrapper.dataset.id = c.id; if (c.id === this.activeComponentId) wrapper.classList.add('selected'); wrapper.onclick = (e) => { e.stopPropagation(); this.selectComponent(c.id); }; if (c.type !== 'lead-form') { wrapper.style.textAlign = c.styles?.textAlign || 'center'; } if ((c.type === 'button' || c.type === 'lead-form') && c.styles?.verticalAlign === 'bottom') { wrapper.style.marginTop = 'auto'; } let element; switch(c.type) { case 'heading': element = document.createElement('h1'); element.textContent = c.content; break; case 'paragraph': element = document.createElement('p'); element.textContent = c.content; break; case 'button': element = document.createElement('button'); element.textContent = c.content; break; case 'lead-form': element = document.createElement('form'); element.className = 'component-content'; let formHTML = (this.allPossibleFormFields.filter(field => c.activeFields?.includes(field.name)) || []).map(field => `<div style="margin-bottom: 8px;"><input type="${field.type}" name="${field.name}" placeholder="${field.placeholder}" required style="width: 100%; padding: 10px; border-radius: 4px; border: 1px solid var(--border-color); background-color: var(--input-bg); color: var(--text-color);"></div>`).join(''); if (c.privacy?.enabled) { formHTML += `<div style="margin-top: 10px; margin-bottom: 15px; text-align: left; display: flex; align-items: center; gap: 8px;"><input type="checkbox" id="privacy-preview-${c.id}" style="width: auto; height: 16px; margin: 0;"><label for="privacy-preview-${c.id}" style="font-size: 12px; color: #94a3b8; font-weight: normal; cursor: pointer;">${c.privacy.text}</label></div>`; } formHTML += `<button type="submit" style="width: 100%; padding: 12px; border: none; border-radius: 4px; background-color: ${c.styles?.submitButtonColor || '#1877f2'}; color: white; font-size: 16px; cursor: pointer;">${c.submitText || '제출'}</button>`; element.innerHTML = formHTML; element.onsubmit = (e) => e.preventDefault(); break; } if (c.type !== 'lead-form') element.className = 'component-content'; const { textAlign, verticalAlign, backgroundColor, backgroundColorOpacity, ...otherStyles } = c.styles || {}; Object.assign(element.style, otherStyles); if (c.type === 'button') { element.style.backgroundColor = this.hexToRgba(backgroundColor || '#1877f2', backgroundColorOpacity); } else if (c.type === 'lead-form' && backgroundColor) { element.style.backgroundColor = backgroundColor; } wrapper.appendChild(element); this.elements.contentArea.appendChild(wrapper);
            });
        }
    },

    renderControls() {
        const isStoryPage = this.components.some(c => c.type === 'scene');
        if (this.elements.pageBackgroundControls) {
            this.elements.pageBackgroundControls.classList.toggle('is-disabled', isStoryPage);
            let notice = this.elements.pageBackgroundControls.querySelector('.disabled-notice');
            if (isStoryPage && !notice) {
                notice = document.createElement('p'); notice.className = 'disabled-notice text-xs text-amber-400 mt-2'; notice.textContent = '※ 스토리 페이지에서는 각 장면의 배경을 사용합니다.'; this.elements.pageBackgroundControls.appendChild(notice);
            } else if (!isStoryPage && notice) { notice.remove(); }
        }
        this.elements.pageBgColorInput.value = this.pageSettings.bgColor || '#DCEAF7'; this.elements.editorsContainer.innerHTML = '';
        this.components.forEach((c, componentIndex) => {
            const panel = document.createElement('div'); panel.className = 'editor-panel'; panel.dataset.id = c.id; const handle = document.createElement('h4'); handle.innerHTML = `${{ heading: '제목', paragraph: '내용', button: '버튼', 'lead-form': '고객 정보', scene: '🎬 장면' }[c.type]} 블록 <div class="panel-controls"><button class="delete-btn" title="삭제">✖</button></div>`; if (c.id === this.activeComponentId) panel.classList.add('selected');
            let panelContentHTML = '';
            if (c.type === 'scene') {
                let innerControlsHTML = '';
                (c.components || []).forEach((innerComp, innerIndex) => { innerControlsHTML += ` <div class="control-group"><label>장면 ${innerComp.type === 'heading' ? '제목' : '내용'}</label><textarea data-scene-inner-prop="${innerIndex}.content">${innerComp.content || ''}</textarea></div> <div class="style-grid"> <div class="control-group"><label>정렬</label><select data-scene-inner-style="${innerIndex}.textAlign"> <option value="left" ${innerComp.styles?.textAlign === 'left' ? 'selected' : ''}>왼쪽</option> <option value="center" ${innerComp.styles?.textAlign === 'center' ? 'selected' : ''}>가운데</option> <option value="right" ${innerComp.styles?.textAlign === 'right' ? 'selected' : ''}>오른쪽</option> </select></div> <div class="control-group"><label>글자색</label><input type="text" data-color-picker data-scene-inner-style="${innerIndex}.color" value="${innerComp.styles?.color || '#FFFFFF'}"></div> <div class="control-group"><label>글자 크기</label><input type="text" data-scene-inner-style="${innerIndex}.fontSize" value="${(innerComp.styles?.fontSize || '').replace('px','')}" placeholder="24"></div> </div> `; });
                panelContentHTML = ` <div class="control-group inline-group"><label>장면 배경색</label><input type="text" data-color-picker data-scene-prop="bgColor" value="${c.sceneSettings?.bgColor || '#333333'}"></div> <div class="control-group"><label>장면 배경 이미지 URL</label><input type="text" data-scene-prop="bgImage" value="${c.sceneSettings?.bgImage || ''}"></div> <hr style="border-color: #475569; margin: 15px 0;"> ${innerControlsHTML} `;
            } else if (c.type === 'lead-form') {
                let checklistHTML = '<div class="control-group"><label>📋 포함할 정보 항목</label><div class="form-fields-checklist" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background-color: #334155; padding: 10px; border-radius: 6px;">'; this.allPossibleFormFields.forEach(field => { const isChecked = c.activeFields?.includes(field.name); checklistHTML += `<div class="inline-group" style="margin-bottom: 0;"><label for="field-${c.id}-${field.name}" style="font-weight: normal; cursor: pointer;">${field.label}</label><input type="checkbox" id="field-${c.id}-${field.name}" data-control-type="field-toggle" data-field-name="${field.name}" ${isChecked ? 'checked' : ''} style="width: auto; cursor: pointer;"></div>`; }); checklistHTML += '</div></div>'; const privacy = c.privacy || { enabled: false, text: '' }; const privacySettingsHTML = `<div class="control-group" style="background-color: #334155; padding: 10px; border-radius: 6px;"><div class="inline-group"><label for="privacy-enabled-${c.id}" style="cursor: pointer;">🔒 개인정보 수집 동의</label><input type="checkbox" id="privacy-enabled-${c.id}" data-control-type="privacy-toggle" ${privacy.enabled ? 'checked' : ''} style="width: auto; cursor: pointer;"></div>${privacy.enabled ? `<div class="control-group" style="margin-top: 10px; margin-bottom: 0;"><label>동의 문구</label><textarea data-prop="privacy.text" style="height: 60px;">${privacy.text}</textarea></div>` : ''}</div>`; panelContentHTML = `${checklistHTML}<div class="control-group"><label>📝 구글 스크립트 URL</label><textarea data-prop="googleScriptUrl" placeholder="배포된 구글 웹 앱 URL" style="height: 80px;">${c.googleScriptUrl || ''}</textarea></div><div class="control-group"><label>✅ 제출 버튼 텍스트</label><input type="text" data-prop="submitText" value="${c.submitText || ''}"></div><div class="control-group"><label>🎉 성공 메시지</label><input type="text" data-prop="successMessage" value="${c.successMessage || ''}"></div><div class="control-group inline-group"><label>버튼 색상</label><input type="text" data-color-picker data-style="submitButtonColor" value="${c.styles?.submitButtonColor || '#1877f2'}"></div>${privacySettingsHTML}`;
            } else {
                let contentHTML = `<div class="control-group"><label>내용</label><textarea data-prop="content">${c.content}</textarea></div>`; if (c.type === 'button') { contentHTML += `<div class="control-group"><label>🔗 링크 URL</label><input type="text" data-prop="link" value="${c.link || ''}" placeholder="https://example.com"></div>`; } let fontSelectorHTML = `<div class="control-group"><label>글꼴</label><select data-style="fontFamily"><option value="'Noto Sans KR', sans-serif">깔끔 고딕체</option><option value="'Nanum Myeongjo', serif">부드러운 명조체</option><option value="'Gaegu', cursive">귀여운 손글씨체</option></select></div>`; let styleGridHTML = '<div class="style-grid">'; styleGridHTML += `<div class="control-group"><label>정렬</label><select data-style="textAlign"><option value="left">왼쪽</option><option value="center">가운데</option><option value="right">오른쪽</option></select></div>`; styleGridHTML += `<div class="control-group"><label>글자색</label><input type="text" data-color-picker data-style="color" value="${c.styles?.color || '#FFFFFF'}"></div>`; styleGridHTML += `<div class="control-group"><label>글자 크기</label><input type="text" data-style="fontSize" value="${(c.styles?.fontSize || '').replace('px','')}" placeholder="24"></div>`; styleGridHTML += '</div>'; let buttonBgColorHTML = ''; if(c.type === 'button') { buttonBgColorHTML = `<div class="control-group inline-group"><label>버튼 배경색</label><input type="text" data-color-picker data-style="backgroundColor" value="${c.styles?.backgroundColor || '#1877f2'}"></div>`; } panelContentHTML = contentHTML + fontSelectorHTML + styleGridHTML + buttonBgColorHTML;
            }
            const contentDiv = document.createElement('div'); contentDiv.innerHTML = panelContentHTML; panel.appendChild(handle); panel.appendChild(contentDiv); this.elements.editorsContainer.appendChild(panel);
            if (c.type !== 'lead-form' && c.type !== 'scene') {
                const textAlignSelect = panel.querySelector('[data-style="textAlign"]'); if(textAlignSelect) textAlignSelect.value = c.styles?.textAlign || 'center';
                const fontFamilySelect = panel.querySelector('[data-style="fontFamily"]'); if(fontFamilySelect) fontFamilySelect.value = c.styles?.fontFamily || "'Noto Sans KR', sans-serif";
            }
        });
        this.attachEventListenersToControls();
    },

    attachEventListenersToControls() {
        this.elements.editorsContainer.querySelectorAll('.editor-panel').forEach(panel => {
            const id = Number(panel.dataset.id);
            panel.addEventListener('click', (e) => { if (e.target.closest('.control-group') || e.target.closest('.panel-controls')) return; this.selectComponent(id); });
            panel.querySelectorAll('[data-prop]').forEach(input => { input.oninput = (e) => this.updateComponent(id, e.target.dataset.prop, e.target.value, false); });
            panel.querySelectorAll('[data-style]').forEach(input => { const eventType = input.hasAttribute('data-color-picker') ? 'change' : 'input'; input.addEventListener(eventType, (e) => { let value = e.target.value; if (e.target.dataset.style === 'fontSize' && value.trim() !== '' && !isNaN(value.trim())) { value += 'px'; } this.updateComponent(id, `styles.${e.target.dataset.style}`, value, false); }); });
            panel.querySelectorAll('[data-scene-prop]').forEach(input => { const eventType = input.hasAttribute('data-color-picker') ? 'change' : 'input'; input.addEventListener(eventType, (e) => { this.updateComponent(id, `sceneSettings.${e.target.dataset.sceneProp}`, e.target.value, false); }); });
            panel.querySelectorAll('[data-scene-inner-prop]').forEach(input => { input.oninput = (e) => { this.updateComponent(id, `components.${e.target.dataset.sceneInnerProp}`, e.target.value, false); }; });
            panel.querySelectorAll('[data-scene-inner-style]').forEach(input => {
                const eventType = input.hasAttribute('data-color-picker') ? 'change' : 'input';
                input.addEventListener(eventType, (e) => {
                    let value = e.target.value;
                    const [index, key] = e.target.dataset.sceneInnerStyle.split('.');
                    if (key === 'fontSize' && value.trim() !== '' && !isNaN(value.trim())) {
                        value += 'px';
                    }
                    this.updateComponent(id, `components.${index}.styles.${key}`, value, false);
                });
            });
            panel.querySelectorAll('[data-control-type="field-toggle"]').forEach(checkbox => { checkbox.onchange = () => { const fieldName = checkbox.dataset.fieldName; const component = this.components.find(c => c.id === id); if (!component) return; if (!component.activeFields) component.activeFields = []; if (checkbox.checked) { if (!component.activeFields.includes(fieldName)) component.activeFields.push(fieldName); } else { component.activeFields = component.activeFields.filter(name => name !== fieldName); } this.saveAndRender(true, true); }; }); panel.querySelector('[data-control-type="privacy-toggle"]')?.addEventListener('change', (e) => { this.updateComponent(id, 'privacy.enabled', e.target.checked, true); });
            panel.querySelector('.delete-btn').onclick = () => this.deleteComponent(id);
        });
    },

    renderViewportControls() {
        this.elements.viewportControlsLeft.innerHTML = '';
        const btnGroup = document.createElement('div');
        btnGroup.className = 'viewport-controls';
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
    
    initSortable() {
        if (this.sortableInstance) this.sortableInstance.destroy();
        this.sortableInstance = new Sortable(this.elements.editorsContainer, { handle: 'h4', animation: 150, ghostClass: 'sortable-ghost', onEnd: (evt) => { if (evt.oldIndex === evt.newIndex) return; const item = this.components.splice(evt.oldIndex, 1)[0]; this.components.splice(evt.newIndex, 0, item); this.saveAndRender(false, true); }, });
    },

    selectComponent(id) {
        this.activeComponentId = id;
        this.renderControls();
        this.renderPreview();
    },

    addComponent(type) {
        const newComponent = { id: Date.now(), type };
        switch(type) {
            case 'heading': newComponent.content = 'Welcome to My Page'; newComponent.styles = { fontFamily: "'Noto Sans KR', sans-serif", textAlign: 'center', color: '#FFFFFF', fontSize: '48px'}; break;
            case 'paragraph': newComponent.content = 'This is a beautiful landing page.'; newComponent.styles = { fontFamily: "'Noto Sans KR', sans-serif", textAlign: 'center', color: '#FFFFFF', fontSize: '20px'}; break;
            case 'button': newComponent.content = 'Explore'; newComponent.link = ''; newComponent.styles = { fontFamily: "'Noto Sans KR', sans-serif", backgroundColor: '#1877f2', color: '#ffffff', padding: '12px 25px', border: 'none', borderRadius: '8px', backgroundColorOpacity: 1, verticalAlign: 'bottom' }; break;
            case 'lead-form': newComponent.googleScriptUrl = ''; newComponent.submitText = '문의 남기기'; newComponent.successMessage = '성공적으로 제출되었습니다. 감사합니다!'; newComponent.activeFields = ['name', 'email']; newComponent.styles = { padding: '25px', borderRadius: '8px', backgroundColor: 'transparent', submitButtonColor: '#1877f2' }; newComponent.privacy = { enabled: true, text: '(필수) 개인정보 수집 및 이용에 동의합니다.' }; break;
            case 'scene':
                newComponent.sceneSettings = { bgColor: '#1e293b', bgImage: '' };
                newComponent.components = [
                    { type: 'heading', content: '새로운 장면의 제목', styles: { color: '#ffffff', fontSize: '36px', textAlign: 'center' } },
                    { type: 'paragraph', content: '장면에 대한 설명을 입력하세요.', styles: { color: '#e2e8f0', fontSize: '18px', textAlign: 'center' } }
                ];
                break;
        }
        this.components.push(newComponent);
        this.activeComponentId = newComponent.id;
        this.saveAndRender(true, true);
    },

    updateComponent(id, keyPath, value, rerenderControls = false) {
        let component = this.components.find(c => c.id === id); if (!component) return;
        const keys = keyPath.split('.'); let current = component;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
                current[keys[i]] = isNaN(Number(keys[i+1])) ? {} : [];
            }
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
        if (rerenderControls) {
            this.renderControls();
        }
        try {
            await firebaseReady;
            const db = getFirestoreDB();
            const docRef = doc(db, "pages", this.currentPageId);
            await updateDoc(docRef, { components: this.components, pageSettings: this.pageSettings, updatedAt: serverTimestamp() });
        } catch (error) { console.error("자동 저장 실패:", error); }
    }
};