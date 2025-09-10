// js/ui.js

// 모든 UI 요소를 담을 중앙 리모컨 객체
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