// js/firebase.js v2.1 - SDK 버전 통일 및 문법 오류 수정

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

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