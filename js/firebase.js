// js/firebase.js v1.3 - Getter 함수 패턴 적용

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";

// 모듈 내부에서만 사용되는 비공개 변수
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

    // 내부 변수에 할당
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

// 초기화 Promise를 실행하고 export하여 외부에서 이 Promise가 끝날 때까지 기다릴 수 있게 함
export const firebaseReady = initFirebase();

// 더 이상 변수를 직접 export하지 않고, 함수를 통해 반환합니다.
export const getFirebaseAuth = () => auth;
export const getFirestoreDB = () => db;
export const getFirebaseStorage = () => storage;