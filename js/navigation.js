// js/navigation.js v2.6 - 광고콘텐츠관리 버튼 추가

import { ui } from './ui.js';

export async function navigateTo(viewName, pageId = null) {
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
                <button id="add-new-subscription-card-button" class="bg-teal-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-teal-600">📧 구독 폼 추가</button>
                <button id="add-new-iframe-card-button" class="bg-indigo-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-600">➕ iframe 카드</button>
                <button id="add-new-card-button" class="bg-emerald-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-emerald-600">➕ 미디어 카드</button>
            </div>`
		// ✨ 아래 'adv-cards' 부분을 새로 추가해주세요!
        'adv-cards': { title: '📢 광고 콘텐츠 관리', action: `
            <div class="flex gap-2">
                <button id="adv-add-new-iframe-card-button" class="bg-indigo-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-600">➕ iframe 카드</button>
                <button id="adv-add-new-card-button" class="bg-emerald-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-emerald-600">➕ 미디어 카드</button>
            </div>`
        },

        },
        editor: { title: '📝 페이지 편집 중...', action: '' }
    };

    if (ui.viewTitle) ui.viewTitle.textContent = viewConfig[viewName]?.title || 'Dashboard';
    if (ui.headerActions) ui.headerActions.innerHTML = viewConfig[viewName]?.action || '';

    if (viewName === 'layout') {
        const { initLayoutView, handleAddContentClick } = await import('./layoutManager.js');
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
        // ✨ [핵심 수정] '구독 폼 추가' 버튼에 이벤트 리스너를 추가합니다.
        document.getElementById('add-new-subscription-card-button')?.addEventListener('click', () => cards.handleAddNewSubscriptionCard());
		
		// ✨ 아래 'else if' 블록 전체를 새로 추가해주세요!
	} else if (viewName === 'adv-cards') {
        const { adv_cards } = await import('./adv_cards.js');
        adv_cards.init();
        // ✨ adv- 접두사가 붙은 새 버튼 ID에 이벤트 리스너를 연결합니다.
        document.getElementById('adv-add-new-card-button')?.addEventListener('click', () => adv_cards.handleAddNewAd());
        document.getElementById('adv-add-new-iframe-card-button')?.addEventListener('click', () => adv_cards.handleAddNewIframeAd());
    } else if (viewName === 'editor' && pageId) {
        const { editor } = await import('./editor.js');
        editor.init(pageId);
    }
}