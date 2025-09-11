// js/firebase.js v2.0 - 디버깅용 버전 확인 로그 추가

// ✨ [디버깅 코드] 이 메시지가 콘솔에 보이는지 확인해주세요!
console.log("🔥🔥🔥 Firebase.js v2.0 파일이 성공적으로 로드되었습니다! 🔥🔥🔥");

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";

let auth, db, storage;

const initFirebase = async () => {
  try {
    const response = await fetch('/.netlify/functions/get-firebase-config');
    if (!response.ok) throw new Error(`Firebase 설정 로딩 실패! (상태: ${response.status})`);
    
    const firebaseConfig = await response.json();
    const app = initializeApp(firebaseConfig);

    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    
    console.log("Firebase initialized successfully!");
  } catch (error) {
    console.error("firebase.js 초기화 중 심각한 에러 발생:", error);
    throw error;
  }
};

export const firebaseReady = initFirebase();

export const getFirebaseAuth = () => auth;
export const getFirestoreDB = () => db;
export const getFirebaseStorage = () => storage;