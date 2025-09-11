// js/main.js v1.3 - Firebase 준비를 명시적으로 기다림

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
// <<< 여기가 핵심! <<<
// auth, db 대신 firebaseReady Promise를 먼저 import 합니다.
import { firebaseReady, auth } from './firebase.js';
import { ui, mapInitialUI, mapDashboardUI } from './ui.js';
import { setupLoginListeners, handleLogout, showAuthMessage } from './auth.js';
import { navigateTo } from './navigation.js';

async function initializeAppAndAuth() {
     try {
        // <<< 여기가 핵심! <<<
        // Firebase 발전소가 예열을 마칠 때까지 여기서 확실하게 기다립니다.
        await firebaseReady;

        mapInitialUI();
        setupLoginListeners();

        // Coloris 라이브러리 초기화
        Coloris({
            el: '[data-color-picker]', theme: 'large', themeMode: 'dark', alpha: false, format: 'hex',
            swatches: ['#0f172a', '#334155', '#e2e8f0', '#34d399', '#f87171', '#fb923c', '#facc15', '#4ade80', '#60a5fa', '#c084fc']
        });

        onAuthStateChanged(auth, user => {
            if (user) {
                // 이제 이 코드는 100% 안전한 타이밍에 실행됩니다.
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