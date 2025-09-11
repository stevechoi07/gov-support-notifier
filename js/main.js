// js/main.js v2.1 - 데이터 모듈 선제적 초기화 적용

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { firebaseReady, getFirebaseAuth, getFirestoreDB, getFirebaseStorage } from './firebase.js'; // ✨ getFirestoreDB, getFirebaseStorage 추가
import { ui, mapInitialUI, mapDashboardUI } from './ui.js';
import { setupLoginListeners, handleLogout, showAuthMessage } from './auth.js';
import { navigateTo } from './navigation.js';

// ✨ [핵심 수정] pages와 cards 모듈을 미리 import 합니다.
import { init as initPages } from './pages.js';
import { cards } from './cards.js';

async function initializeAppAndAuth() {
    try {
        await firebaseReady;
        const auth = getFirebaseAuth();
        
        // ✨ [핵심 수정] Firebase 준비 직후, 핵심 데이터 모듈들을 먼저 초기화합니다.
        const db = getFirestoreDB();
        const storage = getFirebaseStorage();
        initPages({ db });
        cards.init({ db, storage });
        console.log('✅ [main.js] Pages와 Cards 모듈 선제적 초기화 완료!');

        mapInitialUI();
        setupLoginListeners();

        if (typeof Coloris !== 'undefined') {
            Coloris({
                el: '[data-color-picker]', 
                theme: 'large', 
                themeMode: 'dark', 
                alpha: false, 
                format: 'hex',
                swatches: [
                    '#0f172a', '#334155', '#e2e8f0', '#34d399', 
                    '#f87171', '#fb923c', '#facc15', '#4ade80', 
                    '#60a5fa', '#c084fc'
                ]
            });
        }

        onAuthStateChanged(auth, user => {
            if (user) {
                ui.authContainer.classList.add('hidden');
                ui.dashboardContainer.classList.remove('hidden');
                mapDashboardUI();
                setupDashboardListeners();
                navigateTo('layout'); 
            } else {
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

function setupDashboardListeners() {
    if (ui.logoutButton) {
        ui.logoutButton.addEventListener('click', handleLogout);
    }
    if (ui.navLinks) {
        ui.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                navigateTo(link.dataset.view);
            });
        });
    }
}

// ✨ 기존 export 구문은 삭제하고, 함수를 직접 호출하도록 변경합니다.
initializeAppAndAuth();