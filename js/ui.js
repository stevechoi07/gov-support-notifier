// js/ui.js

// 모든 UI 요소를 담을 중앙 리모컨 객체
export const ui = {
    authContainer: null, dashboardContainer: null, passwordInput: null, loginButton: null, authMessage: null,
    logoutButton: null, navLinks: null, views: null, viewTitle: null, headerActions: null, pageListContainer: null,
    mainContent: null,
};

// 로그인 화면 UI 요소를 매핑하는 함수
export function mapInitialUI() {
    console.log("🔍 mapInitialUI 함수 정밀 감식 시작!");
    
    ui.authContainer = document.getElementById('auth-container');
    console.log("   -> #auth-container 찾기 결과:", ui.authContainer);

    ui.dashboardContainer = document.getElementById('dashboard-container');
    console.log("   -> #dashboard-container 찾기 결과:", ui.dashboardContainer);

    ui.passwordInput = document.getElementById('password-input');
    console.log("   -> #password-input 찾기 결과:", ui.passwordInput);

    ui.loginButton = document.getElementById('login-button');
    console.log("   -> #login-button 찾기 결과:", ui.loginButton);

    ui.authMessage = document.getElementById('auth-message');
    console.log("   -> #auth-message 찾기 결과:", ui.authMessage);
    
    console.log("🔍 mapInitialUI 함수 정밀 감식 완료!");
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