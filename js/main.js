// js/main.js v1.2 - 비동기 타이밍 문제 근본적 해결

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
// firebase.js가 비동기적으로 초기화되므로, auth를 사용하는 onAuthStateChanged는
// firebase.js 로딩이 끝난 후에 호출되어야 안전합니다.
import { auth } from './firebase.js'; 
import { ui, mapInitialUI, mapDashboardUI } from './ui.js';
import { setupLoginListeners, handleLogout, showAuthMessage } from './auth.js';
import { navigateTo } from './navigation.js';

// async 키워드를 추가하여 함수 자체를 비동기로 만듭니다.
async function initializeAppAndAuth() {
    try {
        // 이 함수가 실행되는 시점에는 firebase.js의 top-level await가
        // 이미 완료되었음을 모듈 시스템이 보장해줍니다.
        mapInitialUI();
        setupLoginListeners();

        // Coloris 라이브러리 초기화 (기존 기능 유지)
        Coloris({
            el: '[data-color-picker]', theme: 'large', themeMode: 'dark', alpha: false, format: 'hex',
            swatches: ['#0f172a', '#334155', '#e2e8f0', '#34d399', '#f87171', '#fb923c', '#facc15', '#4ade80', '#60a5fa', '#c084fc']
        });

        onAuthStateChanged(auth, user => {
            if (user) {
                ui.authContainer.classList.add('hidden');
                ui.dashboardContainer.classList.remove('hidden');
                
                // 🔴 더 이상 setTimeout 핵이 필요 없습니다!
                // 모듈 시스템이 firebase.js의 로딩을 기다려주기 때문에
                // 이 코드는 항상 안전한 타이밍에 실행됩니다.
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