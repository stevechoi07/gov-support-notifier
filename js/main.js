// js/main.js v2.38 - The Conductor (Stabilized)

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { auth } from './firebase.js';
import { ui, mapInitialUI, mapDashboardUI } from './ui.js';
import { setupLoginListeners, handleLogout, showAuthMessage } from './auth.js';
import { navigateTo } from './navigation.js';

/**
 * 앱을 초기화하고 인증 상태 변화를 감지하는 메인 함수
 */
async function initializeAppAndAuth() {
    try {
        // 1. 로그인 화면 UI를 먼저 매핑하고, 로그인 이벤트 리스너를 설정합니다.
        mapInitialUI();
        setupLoginListeners();

        // 2. Coloris (컬러 피커) 라이브러리 초기화
        Coloris({
            el: '[data-color-picker]', theme: 'large', themeMode: 'dark', alpha: false, format: 'hex',
            swatches: ['#0f172a', '#334155', '#e2e8f0', '#34d399', '#f87171', '#fb923c', '#facc15', '#4ade80', '#60a5fa', '#c084fc']
        });

        // 3. Firebase 인증 상태가 바뀔 때마다 실행될 감시자를 설정합니다.
        onAuthStateChanged(auth, user => {
            if (user) {
                // 사용자가 로그인한 경우
                ui.authContainer.classList.add('hidden');
                ui.dashboardContainer.classList.remove('hidden');
                
                // 🔴 setTimeout을 사용하여 DOM 렌더링 후 대시보드 로직이 실행되도록 보장합니다.
                setTimeout(() => {
                    // 대시보드 UI가 표시된 직후에 대시보드용 UI 요소를 매핑합니다.
                    mapDashboardUI();
                    // 대시보드 공용 이벤트(로그아웃, 네비게이션)를 설정합니다.
                    setupDashboardListeners();

                    // 기본 화면인 '레이아웃 관리' 뷰로 이동시킵니다.
                    navigateTo('layout');
                }, 0);

            } else {
                // 사용자가 로그아웃한 경우
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

/**
 * 대시보드에서 공통적으로 사용되는 이벤트 리스너 (로그아웃, 메뉴 이동)를 설정하는 함수
 */
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

// ✅ index.html에서 import하여 사용할 수 있도록 함수를 export 합니다.
export { initializeAppAndAuth };