// js/firebase.js

// Firebase 앱 관련 모듈 가져오기
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";

console.log("🔍 firebase.js 모듈 실행 시작!");

let auth, db, storage;

try {
    console.log("   -> Netlify 함수로 Firebase 설정 정보 요청 시작...");
    const response = await fetch('/.netlify/functions/get-firebase-config');
    console.log("   -> Netlify 함수 응답 받음:", response);

    if (!response.ok) {
        throw new Error(`Firebase 설정 로딩 실패! (상태: ${response.status})`);
    }

    const firebaseConfig = await response.json();
    console.log("   -> Firebase 설정 정보 (JSON) 파싱 성공!");

    const app = initializeApp(firebaseConfig);
    console.log("   -> Firebase 앱 초기화 성공!");

    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    console.log("   -> Firebase 서비스 (Auth, Firestore, Storage) 연결 완료!");

} catch (error) {
    console.error("❌ firebase.js 초기화 중 심각한 에러 발생:", error);
    // 이 에러를 외부에서도 알 수 있도록 다시 던져줍니다.
    throw error;
}

// 초기화된 Firebase 서비스들을 다른 파일에서 사용할 수 있도록 export
export { auth, db, storage };