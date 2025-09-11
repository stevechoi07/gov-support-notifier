// js/main.js v1.4 - Firebase Getter 적용

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
// ✨ [수정] auth 대신 getFirebaseAuth 함수를 import 합니다.
import { firebaseReady, getFirebaseAuth } from './firebase.js';
import { ui, mapInitialUI, mapDashboardUI } from './ui.js';
import { setupLoginListeners, handleLogout, showAuthMessage } from './auth.js';
import { navigateTo } from './navigation.js';

async function initializeAppAndAuth() {
    try {
        // Firebase 초기화가 완료될 때까지 기다립니다.
        await firebaseReady;
        
        // ✨ [수정] 게이트키퍼 함수를 호출하여 auth 객체를 안전하게 가져옵니다.
        const auth = getFirebaseAuth();

        mapInitialUI();
        setupLoginListeners();

        // Coloris 라이브러리 초기화
        Coloris({
            el: '[data-color-picker]', theme: 'large', themeMode: 'dark', alpha: false, format: 'hex',
            swatches: ['#0f172a', '#334155', '#e2e8f0', '#34d399', '#f87171', '#fb923c', '#facc15', '#4ade80', '#60a5fa', '#c084fc']
        });

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

// ✨ [수정] initializeAppAndAuth 함수만 export 하도록 변경
export { initializeAppAndAuth };