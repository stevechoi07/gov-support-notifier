// js/navigation.js v2.0 - 동적 임포트(Dynamic Import) 적용으로 타이밍 문제 근본 해결

import { ui } from './ui.js';

// ✨ [핵심 변경 1] 파일 상단에서 모든 뷰(pages, cards 등)를 미리 import하지 않습니다.

export async function navigateTo(viewName, pageId = null) { // ✨ [핵심 변경 2] 함수를 async로 변경
    const targetView = document.getElementById(`${viewName}-view`);
    if (!targetView) {
        console.error(`View not found: ${viewName}-view`);
        return;
    }

    if (ui.views) ui.views.forEach(view => view.classList.add('hidden'));
    if (ui.navLinks) ui.navLinks.forEach(link => {
        const isActive = (viewName === 'editor' && link.dataset.view === 'pages') || (viewName === link.dataset.view);
        link.classList.toggle('active', isActive);
    });

    targetView.classList.remove('hidden');
    if (ui.mainContent) ui.mainContent.classList.toggle('p-6', viewName !== 'editor');

    if (ui.viewTitle && ui.viewTitle.isContentEditable) {
        ui.viewTitle.setAttribute('contenteditable', 'false');
    }

    const viewConfig = {
        layout: { title: '🎨 레이아웃 관리', action: `<button id="add-content-btn" class="bg-emerald-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-emerald-600">➕ 콘텐츠 추가</button>` },
        pages: { title: '📄 페이지 관리', action: `<button id="new-page-btn" class="bg-emerald-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-emerald-600">✨ 새 페이지</button>` },
        cards: { title: '🗂️ 콘텐츠 카드 관리', action: `
            <div class="flex gap-2">
                <button id="add-new-iframe-card-button" class="bg-indigo-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-600">➕ iframe 카드</button>
                <button id="add-new-card-button" class="bg-emerald-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-emerald-600">➕ 미디어 카드</button>
            </div>`
        },
        editor: { title: '📝 페이지 편집 중...', action: '' }
    };

    if (ui.viewTitle) ui.viewTitle.textContent = viewConfig[viewName]?.title || 'Dashboard';
    if (ui.headerActions) ui.headerActions.innerHTML = viewConfig[viewName]?.action || '';

    // ✨ [핵심 변경 3] 각 뷰에 해당하는 모듈을 필요할 때 '동적으로' 가져옵니다.
    if (viewName === 'layout') {
        const { initLayoutView, handleAddContentClick } = await import('./layout.js');
        initLayoutView();
        document.getElementById('add-content-btn')?.addEventListener('click', handleAddContentClick);
    } else if (viewName === 'pages') {
        const { init, handleNewPageClick } = await import('./pages.js');
        init();
        document.getElementById('new-page-btn')?.addEventListener('click', handleNewPageClick);
    } else if (viewName === 'cards') {
        const { cards } = await import('./cards.js');
        cards.init();
        document.getElementById('add-new-card-button')?.addEventListener('click', () => cards.handleAddNewAd());
        document.getElementById('add-new-iframe-card-button')?.addEventListener('click', () => cards.handleAddNewIframeAd());
    } else if (viewName === 'editor' && pageId) {
        const { editor } = await import('./editor.js');
        editor.init(pageId);
    }
}