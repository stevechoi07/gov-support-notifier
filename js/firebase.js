// js/firebase.js v1.2 - 초기화 완료 Promise 추가

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";

let auth, db, storage;

// 초기화 로직을 함수로 감싸고, Promise를 반환하게 만듭니다.
const initFirebase = async () => {
  try {
    const response = await fetch('/.netlify/functions/get-firebase-config');
    if (!response.ok) {
      throw new Error(`Firebase 설정 로딩 실패! (상태: ${response.status})`);
    }
    const firebaseConfig = await response.json();
    const app = initializeApp(firebaseConfig);

    // 전역 변수에 할당
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    
    console.log("Firebase initialized successfully!");
  } catch (error) {
    console.error("firebase.js 초기화 중 심각한 에러 발생:", error);
    // 에러를 다시 던져서 앱 시작을 중단시키고 main.js에서 잡을 수 있게 합니다.
    throw error; 
  }
};

// <<< 여기가 핵심! <<<
// 초기화 Promise를 실행하고 export하여 외부에서 이 Promise가 끝날 때까지 기다릴 수 있게 합니다.
export const firebaseReady = initFirebase();

// 초기화가 완료된 후에 사용될 서비스들을 export합니다.
export { auth, db, storage };