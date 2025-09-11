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
            handle: '.content-card-drag-handle', 
            animation: 150,
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
            let previewHTML = '';
            let typeIconHTML = '';
            if (isIframe) {
                typeIconHTML = `<div class="content-card-type-icon" title="iframe 카드">🔗</div>`;
                previewHTML = `<div class="content-card-preview ${noMediaClass}">${typeIconHTML}</div>`;
            } else {
                if (ad.mediaUrl) {
                    if (ad.mediaType === 'video') {
                        typeIconHTML = `<div class="content-card-type-icon" title="비디오 카드">🎬</div>`;
                        previewHTML = `<div class="content-card-preview"><video muted playsinline src="${ad.mediaUrl}"></video>${typeIconHTML}</div>`;
                    } else {
                        typeIconHTML = `<div class="content-card-type-icon" title="이미지 카드">🖼️</div>`;
                        previewHTML = `<div class="content-card-preview"><img src="${ad.mediaUrl}" alt="${ad.title} preview">${typeIconHTML}</div>`;
                    }
                } else {
                    previewHTML = `<div class="content-card-preview ${noMediaClass}"></div>`;
                }
            }
            return `
            <div class="content-card" data-id="${ad.id}">
                ${previewHTML}
                <div class="content-card-content">
                    <div class="content-card-header">
                        <p class="title" title="${ad.title}">${ad.title}</p>
                    </div>
                    <div class="content-card-info">
                        ${statusBadge}
                        ${!isIframe ? `
                        <span class="flex items-center" title="클릭 수">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            ${clickCount}
                        </span>` : ''}
                    </div>
                    <div class="content-card-actions">
                        <div class="publish-info">
                            <label class="toggle-switch">
                                <input type="checkbox" class="ad-status-toggle" data-id="${ad.id}" ${isChecked ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                            </label>
                            <span class="text-sm font-medium ${isChecked ? 'text-emerald-400' : 'text-slate-400'}">${isChecked ? '게시 중' : '비공개'}</span>
                        </div>
                        <div class="action-buttons">
                             <button class="edit-ad-button text-slate-300 hover:text-white" data-id="${ad.id}" title="수정">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                             </button>
                             <button class="delete-ad-button text-red-400 hover:text-red-500" data-id="${ad.id}" title="삭제">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                             </button>
                        </div>
                    </div>
                </div>
                <div class="content-card-drag-handle" title="순서 변경">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                </div>
            </div>`;
        }).join('');

        this.ui.adListContainer.querySelectorAll('.edit-ad-button').forEach(btn => btn.addEventListener('click', this.handleEditAd.bind(this)));
        this.ui.adListContainer.querySelectorAll('.delete-ad-button').forEach(btn => btn.addEventListener('click', this.handleDeleteAd.bind(this)));
        this.ui.adListContainer.querySelectorAll('.ad-status-toggle').forEach(toggle => toggle.addEventListener('change', this.handleToggleAdStatus.bind(this)));
    },
    
    formatDateTime(dateTimeString) { /* 이전과 동일 */ },
    async handleToggleAdStatus(event) { /* 이전과 동일 */ },
    handleFileUpload(event) { /* 이전과 동일 */ },
    resetCardModalState() { /* 이전과 동일 */ },
    handleAddNewAd() { /* 이전과 동일 */ },
    resetIframeModalState() { /* 이전과 동일 */ },
    handleAddNewIframeAd() { /* 이전과 동일 */ },
    handleEditAd(event) { /* 이전과 동일 */ },
    async handleDeleteAd(event) { /* 이전과 동일 */ },
    async uploadMediaFile() { /* 이전과 동일 */ },
    async handleSaveAd() { /* 이전과 동일 */ },
    async handleSaveIframeAd() { /* 이전과 동일 */ },
    updatePreview() { /* 이전과 동일 */ },
};