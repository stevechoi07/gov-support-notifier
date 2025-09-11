// js/cards.js
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, writeBatch, query, orderBy } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";
import { db, storage } from './firebase.js';

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
        this.collection = collection(db, "ads");
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

    listen() {
        const q = query(this.collection, orderBy("order", "asc"));
        onSnapshot(q, (querySnapshot) => {
            this.list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const cardsView = document.getElementById('cards-view');
            if (cardsView && !cardsView.classList.contains('hidden')) {
                this.render();
            }
        });
    },

    initSortable() {
        if (!this.ui.adListContainer) return;
        new Sortable(this.ui.adListContainer, {
            handle: '.drag-handle', animation: 150,
            onEnd: async (evt) => {
                if (evt.oldIndex === evt.newIndex) return;
                const movedItem = this.list.splice(evt.oldIndex, 1)[0];
                this.list.splice(evt.newIndex, 0, movedItem);
                const batch = writeBatch(db);
                this.list.forEach((ad, index) => {
                    batch.update(doc(db, "ads", ad.id), { order: index });
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

    formatDateTime(dateTimeString) {
        if (!dateTimeString) return '...';
        const date = new Date(dateTimeString);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
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
            this.ui.adListContainer.appendChild(adElement);
        });
        this.ui.adListContainer.querySelectorAll('.edit-ad-button').forEach(btn => btn.addEventListener('click', this.handleEditAd.bind(this)));
        this.ui.adListContainer.querySelectorAll('.delete-ad-button').forEach(btn => btn.addEventListener('click', this.handleDeleteAd.bind(this)));
        this.ui.adListContainer.querySelectorAll('.ad-status-toggle').forEach(toggle => toggle.addEventListener('change', this.handleToggleAdStatus.bind(this)));
    },

    async handleToggleAdStatus(event) {
        const id = event.target.dataset.id;
        const isActive = event.target.checked;
        try {
            await updateDoc(doc(db, "ads", id), { isActive: isActive });
            event.target.closest('[data-id]').classList.toggle('opacity-40', !isActive);
        } catch (error) {
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
        btn.disabled = false; btn.innerHTML = `저장하기`; btn.classList.remove('button-disabled');
        this.ui.mediaUploadStatus.style.opacity = 0; this.ui.uploadProgress.textContent = '0%';
        this.ui.progressBarFill.style.width = '0%'; this.ui.uploadLabel.textContent = '업로드 중...';
        this.ui.adTitleInput.value = ''; this.ui.adDescriptionInput.value = ''; this.ui.adLinkInput.value = '';
        this.ui.isPartnersCheckbox.checked = false; this.ui.adStartDateInput.value = '';
        this.ui.adEndDateInput.value = ''; this.ui.adMediaFileInput.value = '';
        this.ui.fileNameDisplay.textContent = '선택된 파일 없음'; this.ui.adPreview.innerHTML = '';
        if (this.tempPreviewUrl) { URL.revokeObjectURL(this.tempPreviewUrl); this.tempPreviewUrl = null; }
    },

    handleAddNewAd() {
        this.editingId = null; this.selectedMediaFile = null; this.currentMediaUrl = ''; this.currentMediaType = 'image';
        this.ui.modalTitle.textContent = "새 미디어 카드";
        this.resetCardModalState(); this.updatePreview();
        this.ui.adModal.classList.add('active');
    },

    resetIframeModalState() {
        const btn = this.ui.saveIframeAdButton;
        this.ui.iframeAdTitleInput.value = ''; this.ui.iframeAdCodeInput.value = '';
        this.ui.iframeIsPartnersCheckbox.checked = false; this.ui.iframeAdStartDateInput.value = '';
        this.ui.iframeAdEndDateInput.value = '';
        btn.disabled = false; btn.innerHTML = '저장하기'; btn.classList.remove('button-disabled');
    },

    handleAddNewIframeAd() {
        this.editingId = null;
        this.ui.iframeModalTitle.textContent = "새 iframe 카드";
        this.resetIframeModalState();
        this.ui.iframeAdModal.classList.add('active');
    },

    handleEditAd(event) {
        this.editingId = event.target.dataset.id;
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
        const idToDelete = event.target.dataset.id;
        const adToDelete = this.list.find(ad => ad.id === idToDelete);
        if (adToDelete && confirm(`'${adToDelete.title}' 카드를 정말 삭제하시겠습니까?`)) {
            try {
                if (adToDelete.mediaUrl) { await deleteObject(ref(storage, adToDelete.mediaUrl)); }
                await deleteDoc(doc(db, "ads", idToDelete));
            } catch (error) {
                console.warn("파일 삭제 실패:", error.message);
                await deleteDoc(doc(db, "ads", idToDelete));
            }
        }
    },

    async uploadMediaFile() {
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
        if (!this.ui.adTitleInput.value.trim()) { alert('카드 제목을 입력해주세요!'); return; }
        const btn = this.ui.saveAdButton;
        btn.disabled = true; btn.innerHTML = `<div class="spinner"></div><span>저장 중...</span>`;
        try {
            let mediaUrlToSave = this.currentMediaUrl;
            if (this.selectedMediaFile) {
                if (this.editingId && this.currentMediaUrl) {
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
                await addDoc(this.collection, adData);
            }
            this.ui.adModal.classList.remove('active');
        } catch (error) {
            console.error("저장 중 오류 발생:", error); alert("작업에 실패했습니다.");
            btn.disabled = false; btn.innerHTML = `저장하기`;
        }
    },

    async handleSaveIframeAd() {
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
                await addDoc(this.collection, adData);
            }
            this.ui.iframeAdModal.classList.remove('active');
        } catch (error) {
            console.error("iframe 카드 저장 중 오류:", error); alert("작업에 실패했습니다.");
            btn.disabled = false; btn.innerHTML = '저장하기';
        }
    },

    updatePreview() {
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