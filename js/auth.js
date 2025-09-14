// js/auth.js v1.5 - SDK 버전 통일

import { signInWithCustomToken, signOut, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { ui } from './ui.js';
import { getFirebaseAuth } from './firebase.js';

export function setupLoginListeners() {
    if (ui.loginButton) {
        ui.loginButton.addEventListener('click', handleLogin);
    }
    if (ui.passwordInput) {
        ui.passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); });
    }
}

async function handleLogin() {
    const auth = getFirebaseAuth();
    if (!auth) {
        showAuthMessage("Firebase 인증 서비스를 사용할 수 없습니다.", true);
        return;
    }
    
    ui.loginButton.disabled = true;
    ui.loginButton.innerHTML = `<div class="spinner"></div><span>로그인 중...</span>`;

    try {
        await setPersistence(auth, browserSessionPersistence);
        const response = await fetch('/.netlify/functions/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: ui.passwordInput.value })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "비밀번호가 틀렸습니다.");
        }

        await signInWithCustomToken(auth, result.token);

    } catch (error) {
        console.error("❌ handleLogin 함수에서 에러 발생:", error);
        showAuthMessage(error.message, true);
        ui.loginButton.disabled = false;
        ui.loginButton.innerHTML = '로그인';
    }
}

export async function handleLogout() {
    const auth = getFirebaseAuth();
    if (!auth) return;

    if (confirm('로그아웃 하시겠습니까?')) {
        await signOut(auth);
    }
}

export function showAuthMessage(message, isError) {
    if (!ui.authMessage) return;
    ui.authMessage.textContent = message;
    ui.authMessage.className = `text-sm text-center mt-4 ${isError ? 'text-red-500' : 'text-slate-500'}`;
    if (!isError) ui.authMessage.classList.add('hidden');
    else ui.authMessage.classList.remove('hidden');
}