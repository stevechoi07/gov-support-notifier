/// js/navigation.js v2.4 - 역할 축소 버전

import { ui } from './ui.js';

export async function navigateTo(viewName, pageId = null) {
    const targetView = document.getElementById(`${viewName}-view`);
    if (!targetView) {
        console.error(`View not found: ${viewName}-view`);
        return;
    }

    // DB 주입 및 선제적 초기화 로직 모두 제거

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

// ✨ 각 모듈의 init 함수를 파라미터 없이 호출합니다.
    if (viewName === 'layout') {
        const { initLayoutView, handleAddContentClick } = await import('./layout.js');
        initLayoutView();
        document.getElementById('add-content-btn')?.addEventListener('click', handleAddContentClick);
    } else if (viewName === 'pages') {
        const { init, handleNewPageClick } = await import('./pages.js');
        init();
        document.getElementById('new-page-btn')?.addEventListener('click', async () => {
            const newPageId = await handleNewPageClick();
            if (newPageId) navigateTo('editor', newPageId);
        });
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