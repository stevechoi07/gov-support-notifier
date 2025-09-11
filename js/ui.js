// js/ui.js v1.1 - UI 요소 관리자와 헬퍼 함수 통합

// --- 1. UI 요소 관리자 ---
// 앱의 모든 UI 요소를 담을 중앙 리모컨 객체
export const ui = {
    authContainer: null, dashboardContainer: null, passwordInput: null, loginButton: null, authMessage: null,
    logoutButton: null, navLinks: null, views: null, viewTitle: null, headerActions: null, pageListContainer: null,
    mainContent: null,
};

// 로그인 화면 UI 요소를 매핑하는 함수
export function mapInitialUI() {
    ui.authContainer = document.getElementById('auth-container');
    ui.dashboardContainer = document.getElementById('dashboard-container');
    ui.passwordInput = document.getElementById('password-input');
    ui.loginButton = document.getElementById('login-button');
    ui.authMessage = document.getElementById('auth-message');
}

// 대시보드 화면 UI 요소를 매핑하는 함수
export function mapDashboardUI() {
    ui.logoutButton = document.getElementById('logout-button');
    ui.navLinks = document.querySelectorAll('.nav-link');
    ui.views = document.querySelectorAll('.view');
    ui.viewTitle = document.getElementById('view-title');
    ui.headerActions = document.getElementById('header-actions');
    ui.pageListContainer = document.getElementById('page-list-container');
    ui.mainContent = document.getElementById('main-content');
}


// --- 2. UI 헬퍼 함수 ---

/**
 * 화면에 잠시 나타났다가 사라지는 알림 메시지(토스트)를 표시합니다.
 * @param {string} message - 표시할 메시지 내용
 * @param {string} type - 'success' (초록색) 또는 'error' (빨간색)
 */
export function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.className = 'toast-notification';
  
  if (type === 'error') {
    toast.classList.add('error');
  } else {
    toast.classList.add('success');
  }

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('transitionend', () => toast.remove());
  }, 2500);
}