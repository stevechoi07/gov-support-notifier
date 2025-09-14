// js/cards.js v2.1 - SDK 버전 통일 및 Promise 기반 초기화

import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, writeBatch, query, orderBy } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";
import { firebaseReady, getFirestoreDB, getFirebaseStorage } from './firebase.js';

// ✨ [추가] 첫 데이터 로딩 완료 신호를 보내기 위한 Promise와 resolve 함수
let resolveCardsReady;
export const cardsReady = new Promise(resolve => {
    resolveCardsReady = resolve;
});

export const cards = {
    list: [],
    editingId: null,
    selectedMediaFile: null,
    currentMediaUrl: '',
    currentMediaType: 'image',
    currentUploadTask: null,
    tempPreviewUrl: null,
    ui: {},
    isInitialized: false,
    
    init() {
        if (this.isInitialized) {
            this.render();
            return;
        }
        this.mapUI();
        this.addEventListeners();
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
        this.ui.closeModalButton?.addEventListener('click', () => this.ui.adModal.classList.remove('active'));
        this.ui.saveAdButton?.addEventListener('click', this.handleSaveAd.bind(this));
        
        [this.ui.adTitleInput, this.ui.adDescriptionInput, this.ui.adLinkInput, this.ui.isPartnersCheckbox].forEach(input => {
            if(input) input.addEventListener('input', () => this.updatePreview());
        });
        
        this.ui.adMediaFileInput?.addEventListener('change', this.handleFileUpload.bind(this));
        this.ui.closeIframeModalButton?.addEventListener('click', () => this.ui.iframeAdModal.classList.remove('active'));
        this.ui.saveIframeAdButton?.addEventListener('click', this.handleSaveIframeAd.bind(this));
    },

    async listen() {
        await firebaseReady;
        const db = getFirestoreDB();
        const q = query(collection(db, "ads"), orderBy("order", "asc"));
        onSnapshot(q, (querySnapshot) => {
            this.list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const cardsView = document.getElementById('cards-view');
            if (cardsView && !cardsView.classList.contains('hidden')) {
                this.render();
            }
            // ✨ [추가] 첫 데이터 수신 후, 준비 완료 신호를 보냅니다.
            if (resolveCardsReady) {
                resolveCardsReady();
                resolveCardsReady = null; // 한번만 실행되도록 null로 설정
            }
        });
    },

    initSortable() {
        if (!this.ui.adListContainer) return;
        new Sortable(this.ui.adListContainer, {
            handle: '.content-card-drag-handle', 
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: async (evt) => {
                await firebaseReady;
                const db = getFirestoreDB();
                if (evt.oldIndex === evt.newIndex) return;

                const newOrderIds = Array.from(evt.to.children).map(item => item.dataset.id);
                const reorderedList = newOrderIds.map(id => this.list.find(item => item.id === id));
                
                const batch = writeBatch(db);
                reorderedList.forEach((ad, index) => {
                    if (ad) {
                        batch.update(doc(db, "ads", ad.id), { order: index });
                    }
                });
                await batch.commit();
            },
        });
    },

    getAdStatus(ad) {
        const now = new Date();
        const start = ad.startDate ? new Date(ad.startDate) : null;
        const end = ad.endDate ? new Date(ad.endDate) : null;
        if (!start && !end) return `<span class="status-badge bg-slate-600 text-slate-200">상시</span>`;
        if (start && now < start) return `<span class="status-badge bg-blue-500 text-white">예정</span>`;
        if (end && now > end) return `<span class="status-badge bg-red-500 text-white">종료</span>`;
        return `<span class="status-badge bg-emerald-500 text-white">진행중</span>`;
    },
    
    render() {
        if (!this.ui.adListContainer) return;
        this.ui.adListContainer.className = 'card-grid';

        if (this.list.length === 0) {
            this.ui.adListContainer.innerHTML = `<p class="text-center text-slate-500 py-8 col-span-full">등록된 카드가 없습니다.</p>`;
            return;
        }
        
        this.ui.adListContainer.innerHTML = this.list.map(ad => {
            const isIframe = ad.adType === 'iframe';
            const clickCount = ad.clickCount || 0;
            const statusBadge = this.getAdStatus(ad);
            const isChecked = ad.isActive !== false;
            const noMediaClass = (!isIframe && !ad.mediaUrl) ? 'no-media' : '';
            let previewHTML = '', typeIconHTML = '';

            if (isIframe) {
                typeIconHTML = `<div class="content-card-type-icon" title="iframe 카드">🔗</div>`;
                previewHTML = `<div class="content-card-preview ${noMediaClass}">${typeIconHTML}</div>`;
            } else {
                if (ad.mediaUrl) {
                    typeIconHTML = ad.mediaType === 'video' ? `<div class="content-card-type-icon" title="비디오 카드">🎬</div>` : `<div class="content-card-type-icon" title="이미지 카드">🖼️</div>`;
                    previewHTML = ad.mediaType === 'video' ? `<div class="content-card-preview"><video muted playsinline src="${ad.mediaUrl}"></video>${typeIconHTML}</div>` : `<div class="content-card-preview"><img src="${ad.mediaUrl}" alt="${ad.title} preview">${typeIconHTML}</div>`;
                } else {
                    previewHTML = `<div class="content-card-preview ${noMediaClass}"></div>`;
                }
            }

            return `
            <div class="content-card ${isChecked ? '' : 'opacity-40'}" data-id="${ad.id}">
                ${previewHTML}
                <div class="content-card-content">
                    <div class="content-card-header"><p class="title" title="${ad.title}">${ad.title}</p></div>
                    <div class="content-card-info">
                        ${statusBadge}
                        ${!isIframe ? `<span class="flex items-center" title="클릭 수"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>${clickCount}</span>` : ''}
                    </div>
                    <div class="content-card-actions">
                        <div class="publish-info">
                            <label class="toggle-switch"><input type="checkbox" class="ad-status-toggle" data-id="${ad.id}" ${isChecked ? 'checked' : ''}><span class="toggle-slider"></span></label>
                            <span class="text-sm font-medium ${isChecked ? 'text-emerald-400' : 'text-slate-400'}">${isChecked ? '게시 중' : '비공개'}</span>
                        </div>
                        <div class="action-buttons">
                             <button class="edit-ad-button text-slate-300 hover:text-white" data-id="${ad.id}" title="수정"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></button>
                             <button class="delete-ad-button text-red-400 hover:text-red-500" data-id="${ad.id}" title="삭제"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                        </div>
                    </div>
                </div>
                <div class="content-card-drag-handle" title="순서 변경"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg></div>
            </div>`;
        }).join('');

        this.ui.adListContainer.querySelectorAll('.edit-ad-button').forEach(btn => btn.addEventListener('click', this.handleEditAd.bind(this)));
        this.ui.adListContainer.querySelectorAll('.delete-ad-button').forEach(btn => btn.addEventListener('click', this.handleDeleteAd.bind(this)));
        this.ui.adListContainer.querySelectorAll('.ad-status-toggle').forEach(toggle => toggle.addEventListener('change', this.handleToggleAdStatus.bind(this)));
    },

    async handleToggleAdStatus(event) {
        await firebaseReady;
        const db = getFirestoreDB();
        const id = event.target.dataset.id;
        const isActive = event.target.checked;
        try { await updateDoc(doc(db, "ads", id), { isActive: isActive }); } catch (error) {
            alert("상태 변경에 실패했습니다.");
            event.target.checked = !isActive;
        }
    },

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) {
            this.ui.fileNameDisplay.textContent = '선택된 파일 없음'; this.selectedMediaFile = null;
            if (this.tempPreviewUrl) URL.revokeObjectURL(this.tempPreviewUrl);
            this.tempPreviewUrl = null; this.updatePreview(); return;
        }
        if (file.size > 50 * 1024 * 1024) {
            alert('파일 크기는 50MB를 초과할 수 없습니다.');
            this.ui.adMediaFileInput.value = '';
            this.ui.fileNameDisplay.textContent = '선택된 파일 없음';
            return;
        }
        this.selectedMediaFile = file; this.ui.fileNameDisplay.textContent = file.name;
        this.currentMediaType = file.type.startsWith('image/') ? 'image' : 'video';
        if (this.tempPreviewUrl) URL.revokeObjectURL(this.tempPreviewUrl);
        this.tempPreviewUrl = URL.createObjectURL(file);
        this.updatePreview();
    },

    resetCardModalState() {
        const btn = this.ui.saveAdButton;
        if(btn) {
            btn.disabled = false; btn.innerHTML = `저장하기`; btn.classList.remove('button-disabled');
        }
        if(this.ui.mediaUploadStatus) this.ui.mediaUploadStatus.style.opacity = 0; 
        if(this.ui.uploadProgress) this.ui.uploadProgress.textContent = '0%';
        if(this.ui.progressBarFill) this.ui.progressBarFill.style.width = '0%'; 
        if(this.ui.uploadLabel) this.ui.uploadLabel.textContent = '업로드 중...';
        if(this.ui.adTitleInput) this.ui.adTitleInput.value = ''; 
        if(this.ui.adDescriptionInput) this.ui.adDescriptionInput.value = ''; 
        if(this.ui.adLinkInput) this.ui.adLinkInput.value = '';
        if(this.ui.isPartnersCheckbox) this.ui.isPartnersCheckbox.checked = false; 
        if(this.ui.adStartDateInput) this.ui.adStartDateInput.value = '';
        if(this.ui.adEndDateInput) this.ui.adEndDateInput.value = ''; 
        if(this.ui.adMediaFileInput) this.ui.adMediaFileInput.value = '';
        if(this.ui.fileNameDisplay) this.ui.fileNameDisplay.textContent = '선택된 파일 없음'; 
        if(this.ui.adPreview) this.ui.adPreview.innerHTML = '';
        if (this.tempPreviewUrl) { URL.revokeObjectURL(this.tempPreviewUrl); this.tempPreviewUrl = null; }
    },

    handleAddNewAd() {
        this.editingId = null; this.selectedMediaFile = null; this.currentMediaUrl = ''; this.currentMediaType = 'image';
        if(this.ui.modalTitle) this.ui.modalTitle.textContent = "새 미디어 카드";
        this.resetCardModalState(); this.updatePreview();
        if(this.ui.adModal) this.ui.adModal.classList.add('active');
    },

    resetIframeModalState() {
        const btn = this.ui.saveIframeAdButton;
        if(this.ui.iframeAdTitleInput) this.ui.iframeAdTitleInput.value = ''; 
        if(this.ui.iframeAdCodeInput) this.ui.iframeAdCodeInput.value = '';
        if(this.ui.iframeIsPartnersCheckbox) this.ui.iframeIsPartnersCheckbox.checked = false; 
        if(this.ui.iframeAdStartDateInput) this.ui.iframeAdStartDateInput.value = '';
        if(this.ui.iframeAdEndDateInput) this.ui.iframeAdEndDateInput.value = '';
        if(btn){
            btn.disabled = false; btn.innerHTML = '저장하기'; btn.classList.remove('button-disabled');
        }
    },

    handleAddNewIframeAd() {
        this.editingId = null;
        if(this.ui.iframeModalTitle) this.ui.iframeModalTitle.textContent = "새 iframe 카드";
        this.resetIframeModalState();
        if(this.ui.iframeAdModal) this.ui.iframeAdModal.classList.add('active');
    },

    handleEditAd(event) {
        this.editingId = event.currentTarget.dataset.id;
        const ad = this.list.find(ad => ad.id === this.editingId);
        if (!ad) return;
        if (ad.adType === 'iframe') {
            this.resetIframeModalState();
            this.ui.iframeModalTitle.textContent = "iframe 카드 수정";
            this.ui.iframeAdTitleInput.value = ad.title;
            this.ui.iframeAdCodeInput.value = ad.iframeCode || '';
            this.ui.iframeIsPartnersCheckbox.checked = ad.isPartners || false;
            this.ui.iframeAdStartDateInput.value = ad.startDate || '';
            this.ui.iframeAdEndDateInput.value = ad.endDate || '';
            this.ui.iframeAdModal.classList.add('active');
        } else {
            this.resetCardModalState();
            this.selectedMediaFile = null;
            this.currentMediaUrl = ad.mediaUrl || ''; this.currentMediaType = ad.mediaType || 'image';
            this.ui.modalTitle.textContent = "미디어 카드 수정";
            this.ui.adTitleInput.value = ad.title;
            this.ui.adDescriptionInput.value = ad.description || ''; this.ui.adLinkInput.value = ad.link || '';
            this.ui.isPartnersCheckbox.checked = ad.isPartners || false;
            this.ui.adStartDateInput.value = ad.startDate || ''; this.ui.adEndDateInput.value = ad.endDate || '';
            this.ui.fileNameDisplay.textContent = ad.mediaUrl ? '기존 파일 유지' : '선택된 파일 없음';
            this.updatePreview(); this.ui.adModal.classList.add('active');
        }
    },

    async handleDeleteAd(event) {
        await firebaseReady;
        const db = getFirestoreDB();
        const storage = getFirebaseStorage();
        const idToDelete = event.currentTarget.dataset.id;
        const adToDelete = this.list.find(ad => ad.id === idToDelete);
        if (adToDelete && confirm(`'${adToDelete.title}' 카드를 정말 삭제하시겠습니까?`)) {
            try {
                if (adToDelete.mediaUrl) { await deleteObject(ref(storage, adToDelete.mediaUrl)); }
                await deleteDoc(doc(db, "ads", idToDelete));
            } catch (error) {
                if (error.code !== 'storage/object-not-found') { console.error("파일 삭제 중 에러 발생:", error); }
                await deleteDoc(doc(db, "ads", idToDelete));
            }
        }
    },

    async uploadMediaFile() {
        await firebaseReady;
        const storage = getFirebaseStorage();
        return new Promise((resolve, reject) => {
            this.ui.mediaUploadStatus.style.opacity = 1;
            const fileName = `ad_${Date.now()}_${this.selectedMediaFile.name}`;
            const folder = this.currentMediaType === 'video' ? 'ad_videos' : 'ad_images';
            const storageRef = ref(storage, `${folder}/${fileName}`);
            this.currentUploadTask = uploadBytesResumable(storageRef, this.selectedMediaFile);
            this.currentUploadTask.on('state_changed', 
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    this.ui.uploadProgress.textContent = `${Math.round(progress)}%`;
                    this.ui.progressBarFill.style.width = `${progress}%`;
                }, 
                (error) => { reject(error); }, 
                async () => {
                    const downloadURL = await getDownloadURL(this.currentUploadTask.snapshot.ref);
                    resolve(downloadURL);
                }
            );
        });
    },

    async handleSaveAd() {
        await firebaseReady;
        const db = getFirestoreDB();
        if (!this.ui.adTitleInput.value.trim()) { alert('카드 제목을 입력해주세요!'); return; }
        const btn = this.ui.saveAdButton;
        btn.disabled = true; btn.innerHTML = `<div class="spinner"></div><span>저장 중...</span>`;
        try {
            let mediaUrlToSave = this.currentMediaUrl;
            if (this.selectedMediaFile) {
                if (this.editingId && this.currentMediaUrl) {
                    const storage = getFirebaseStorage();
                    try { await deleteObject(ref(storage, this.currentMediaUrl)); } catch (e) { console.warn("Could not delete old file:", e.message); }
                }
                mediaUrlToSave = await this.uploadMediaFile();
                this.ui.uploadLabel.textContent = '업로드 완료!';
            }
            const adData = {
                adType: 'card', title: this.ui.adTitleInput.value, description: this.ui.adDescriptionInput.value,
                link: this.ui.adLinkInput.value, isPartners: this.ui.isPartnersCheckbox.checked,
                mediaUrl: mediaUrlToSave, mediaType: this.currentMediaType,
                startDate: this.ui.adStartDateInput.value, endDate: this.ui.adEndDateInput.value,
            };
            if (this.editingId) {
                const ad = this.list.find(ad => ad.id === this.editingId);
                Object.assign(adData, { order: ad.order, clickCount: ad.clickCount || 0, isActive: ad.isActive !== false });
                await updateDoc(doc(db, "ads", this.editingId), adData);
            } else {
                Object.assign(adData, { order: this.list.length, clickCount: 0, isActive: true });
                await addDoc(collection(db, "ads"), adData);
            }
            this.ui.adModal.classList.remove('active');
        } catch (error) {
            console.error("저장 중 오류 발생:", error); alert("작업에 실패했습니다.");
            btn.disabled = false; btn.innerHTML = `저장하기`;
        }
    },

    async handleSaveIframeAd() {
        await firebaseReady;
        const db = getFirestoreDB();
        const title = this.ui.iframeAdTitleInput.value.trim();
        const code = this.ui.iframeAdCodeInput.value.trim();
        if (!title || !code) { alert('제목과 코드를 모두 입력해주세요!'); return; }
        const btn = this.ui.saveIframeAdButton;
        btn.disabled = true; btn.innerHTML = `<div class="spinner"></div><span>저장 중...</span>`;
        try {
            const adData = {
                adType: 'iframe', title: title, iframeCode: code,
                isPartners: this.ui.iframeIsPartnersCheckbox.checked,
                startDate: this.ui.iframeAdStartDateInput.value, endDate: this.ui.iframeAdEndDateInput.value,
            };
            if (this.editingId) {
                const ad = this.list.find(ad => ad.id === this.editingId);
                Object.assign(adData, { order: ad.order, clickCount: 0, isActive: ad.isActive !== false });
                await updateDoc(doc(db, "ads", this.editingId), adData);
            } else {
                Object.assign(adData, { order: this.list.length, clickCount: 0, isActive: true });
                await addDoc(collection(db, "ads"), adData);
            }
            this.ui.iframeAdModal.classList.remove('active');
        } catch (error) {
            console.error("iframe 카드 저장 중 오류:", error); alert("작업에 실패했습니다.");
            btn.disabled = false; btn.innerHTML = '저장하기';
        }
    },

    updatePreview() {
        if (!this.ui.adPreview) return;
        const title = this.ui.adTitleInput.value || "카드 제목";
        const description = this.ui.adDescriptionInput.value || "카드 설명이 여기에 표시됩니다.";
        const mediaSrc = this.tempPreviewUrl || this.currentMediaUrl;
        let mediaElement = '';
        if (mediaSrc) {
            const type = this.selectedMediaFile ? this.currentMediaType : (this.list.find(ad => ad.id === this.editingId)?.mediaType || 'image');
            mediaElement = type === 'video' ? `<video autoplay loop muted playsinline src="${mediaSrc}"></video>` : `<img src="${mediaSrc}" alt="Ad preview">`;
        } else {
            mediaElement = `<div class="flex items-center justify-center h-full bg-slate-800 rounded-t-xl"><span class="text-slate-500 text-sm">미디어 파일 없음</span></div>`;
        }
        const partnersText = this.ui.isPartnersCheckbox.checked ? `<p class="mt-2 text-xs text-slate-500">이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>` : '';
        this.ui.adPreview.innerHTML = `
          <div class="preview-media-container">${mediaElement}</div>
          <div class="p-4 flex-grow flex flex-col">
              <span class="text-sm font-semibold text-slate-400 uppercase tracking-wide">Sponsored</span>
              <p class="mt-2 text-lg leading-tight font-bold text-slate-100">${title}</p>
              <p class="mt-2 text-slate-400 text-sm flex-grow">${description}</p>
              <div class="mt-auto">${partnersText}</div>
              <div class="mt-4 pt-4 border-t border-slate-600 text-right">
                   <span class="text-sm font-semibold text-emerald-400">자세히 보기 &rarr;</span>
              </div>
          </div>`;
    },
};