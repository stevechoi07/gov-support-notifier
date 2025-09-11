// js/main.js v2.35.1
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { auth } from './firebase.js';
import { ui, mapInitialUI, mapDashboardUI } from './ui.js';
import { setupLoginListeners, handleLogout, showAuthMessage } from './auth.js';
import { navigateTo } from './navigation.js';

async function initializeAppAndAuth() {
    try {
        mapInitialUI();
        setupLoginListeners();

        Coloris({
            el: '[data-color-picker]', theme: 'large', themeMode: 'dark', alpha: false, format: 'hex',
            swatches: ['#0f172a', '#334155', '#e2e8f0', '#34d399', '#f87171', '#fb923c', '#facc15', '#4ade80', '#60a5fa', '#c084fc']
        });

        onAuthStateChanged(auth, user => {
            if (user) {
                ui.authContainer.classList.add('hidden');
                ui.dashboardContainer.classList.remove('hidden');
                
                // DOM이 준비된 후 실행되도록 setTimeout 래퍼를 유지합니다.
                setTimeout(() => {
                    mapDashboardUI();
                    setupDashboardListeners();
                    navigateTo('pages'); // 첫 화면을 '페이지 관리'로 설정
                }, 0);

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

// ✅ 사용자님께서 확인하신 가장 안정적인 방식으로 함수를 export 합니다.
export { initializeAppAndAuth };