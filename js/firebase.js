// js/firebase.js

// Firebase 앱 관련 모듈 가져오기
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";

// Firebase 구성 정보 가져오기 및 초기화
const response = await fetch('/.netlify/functions/get-firebase-config');
if (!response.ok) throw new Error(`Firebase 설정 로딩 실패!`);
const firebaseConfig = await response.json();
const app = initializeApp(firebaseConfig);

// 초기화된 Firebase 서비스들을 다른 파일에서 사용할 수 있도록 export
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);