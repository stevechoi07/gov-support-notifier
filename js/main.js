// js/main.js v1.5 - Firebase 준비를 명시적으로 기다림

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { firebaseReady, getFirebaseAuth } from './firebase.js';
import { ui, mapInitialUI, mapDashboardUI } from './ui.js';
import { setupLoginListeners, handleLogout } from './auth.js';
import { navigateTo } from './navigation.js';

async function initializeAppAndAuth() {
     try {
        // Firebase 발전소가 예열을 마칠 때까지 여기서 확실하게 기다립니다.
        await firebaseReady;

        mapInitialUI();
        setupLoginListeners();

        // Coloris 라이브러리 초기화
        Coloris({
            el: '[data-color-picker]',
            theme: 'large',
            themeMode: 'dark',
            alpha: false,
            format: 'hex',
            swatches: ['#0f172a', '#334155', '#e2e8f0', '#34d399', '#f87171', '#fb923c', '#facc15', '#4ade80', '#60a5fa', '#c084fc']
        });

        onAuthStateChanged(getFirebaseAuth(), user => {
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
        // showAuthMessage 함수가 auth.js에 있으므로 여기서 직접 호출하기보다
        // auth.js를 통해 UI를 업데이트하는 것이 좋습니다.
        const authMessageEl = document.getElementById('auth-message');
        if (authMessageEl) {
            authMessageEl.textContent = "초기화 실패. 관리자에게 문의하세요.";
            authMessageEl.className = 'text-sm text-center mt-4 text-red-500';
            authMessageEl.classList.remove('hidden');
        }
        const loginButtonEl = document.getElementById('login-button');
        if (loginButtonEl) loginButtonEl.disabled = true;
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