// js/main.js v1.6

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { firebaseReady, getFirebaseAuth } from './firebase.js';
import { ui, mapInitialUI, mapDashboardUI } from './ui.js';
import { setupLoginListeners, handleLogout } from './auth.js';
import { navigateTo } from './navigation.js';

let isDashboardInitialized = false;

// 앱을 시작하고 인증 상태를 감시하는 메인 함수
async function initializeAppAndAuth() {
     try {
        // Firebase가 준비될 때까지 명시적으로 기다립니다.
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
              // 대시보드 중복 초기화를 방지합니다.
                if (isDashboardInitialized) return;

                ui.authContainer.classList.add('hidden');
                ui.dashboardContainer.classList.remove('hidden');
                mapDashboardUI();
                setupDashboardListeners();
                navigateTo('layout'); 
              isDashboardInitialized = true;
            } else {
                ui.authContainer.classList.remove('hidden');
                ui.dashboardContainer.classList.add('hidden');
              isDashboardInitialized = false; // 로그아웃 시 상태 초기화
            }
        });

    } catch (error) {
        console.error("initializeAppAndAuth 함수에서 에러 발생:", error);
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

// 대시보드의 모든 이벤트 리스너를 설정하는 함수
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

    // 'navigate'라는 방송(Custom Event)을 들을 수 있도록 리스너를 설정합니다.
    document.addEventListener('navigate', (e) => {
        const { view, pageId } = e.detail;
        navigateTo(view, pageId);
    });
}

export { initializeAppAndAuth };