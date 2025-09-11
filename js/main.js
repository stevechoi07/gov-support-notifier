// js/main.js v2.0 - export 문제 해결

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { firebaseReady, getFirebaseAuth } from './firebase.js';
import { ui, mapInitialUI, mapDashboardUI } from './ui.js';
import { setupLoginListeners, handleLogout, showAuthMessage } from './auth.js';
import { navigateTo } from './navigation.js';

async function initializeAppAndAuth() {
    try {
        await firebaseReady;
        const auth = getFirebaseAuth();

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

// ✨ [수정] 파일 맨 아래에서 함수를 직접 호출하는 대신, export 구문을 추가합니다.
// initializeAppAndAuth(); // 이 줄을 삭제하거나 주석 처리
export { initializeAppAndAuth }; // 이 줄을 추가