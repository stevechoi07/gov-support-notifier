// js/main.js v1.9 - Coloris 전역 초기화

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

        // ✨ [핵심 수정] Coloris 라이브러리를 앱 시작 시 여기서 딱 한 번만 초기화합니다.
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

export { initializeAppAndAuth };