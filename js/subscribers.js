// js/subscribers.js (새 파일)

import { collection, onSnapshot, query, orderBy, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { firebaseReady, getFirestoreDB } from './firebase.js';
import { showToast } from "./ui.js";

export const subscribers = {
    list: [],
    ui: {},
    isInitialized: false,

    init() {
        if (this.isInitialized) return;
        this.mapUI();
        this.addEventListeners();
        this.listen();
        this.isInitialized = true;
    },

    mapUI() {
        this.ui = {
            statsContainer: document.getElementById('subscriber-stats'),
            listContainer: document.getElementById('subscriber-list-container'),
        };
    },

    addEventListeners() {
        // 삭제 버튼에 대한 이벤트 리스너는 render 함수에서 동적으로 추가합니다.
        this.ui.listContainer.addEventListener('click', (event) => {
            if (event.target.classList.contains('delete-subscriber-button')) {
                const id = event.target.dataset.id;
                this.handleDeleteSubscriber(id);
            }
        });
    },

    async listen() {
        await firebaseReady;
        const db = getFirestoreDB();
        // 'subscribers' 컬렉션에서 'createdAt' 필드를 기준으로 내림차순 정렬하여 가져옵니다.
        // 필드명이 다를 경우 수정해주세요. (예: subscribedAt, timestamp 등)
        const q = query(collection(db, "subscribers"), orderBy("createdAt", "desc"));
        
        onSnapshot(q, (querySnapshot) => {
            this.list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.render();
        });
    },

    render() {
        if (!this.ui.listContainer) return;

        // 통계 렌더링
        this.ui.statsContainer.innerHTML = `
            <p class="text-lg text-slate-300">총 <span class="font-bold text-emerald-400">${this.list.length}</span>명의 구독자가 있습니다.</p>
        `;

        // 리스트 렌더링 (테이블)
        let tableHTML = `
            <div class="overflow-x-auto">
                <table class="w-full text-sm text-left text-slate-400">
                    <thead class="text-xs text-slate-300 uppercase bg-slate-700">
                        <tr>
                            <th scope="col" class="px-6 py-3">이메일</th>
                            <th scope="col" class="px-6 py-3">구독일</th>
                            <th scope="col" class="px-6 py-3 text-right">관리</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        if (this.list.length === 0) {
            tableHTML += `<tr><td colspan="3" class="px-6 py-8 text-center">구독자가 없습니다.</td></tr>`;
        } else {
            this.list.forEach(subscriber => {
                // Firestore Timestamp를 JavaScript Date 객체로 변환
                const subscribedDate = subscriber.createdAt?.toDate ? subscriber.createdAt.toDate() : new Date();
                const formattedDate = subscribedDate.toLocaleString('ko-KR', {
                    year: 'numeric', month: 'long', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                });

                tableHTML += `
                    <tr class="bg-slate-800 border-b border-slate-700 hover:bg-slate-600">
                        <td class="px-6 py-4 font-medium text-white">${subscriber.email}</td>
                        <td class="px-6 py-4">${formattedDate}</td>
                        <td class="px-6 py-4 text-right">
                            <button data-id="${subscriber.id}" class="delete-subscriber-button font-medium text-red-500 hover:underline">삭제</button>
                        </td>
                    </tr>
                `;
            });
        }

        tableHTML += `</tbody></table></div>`;
        this.ui.listContainer.innerHTML = tableHTML;
    },

    async handleDeleteSubscriber(id) {
        if (!id) return;
        const subscriberToDelete = this.list.find(sub => sub.id === id);
        if (confirm(`'${subscriberToDelete.email}' 구독자를 정말 삭제하시겠습니까?`)) {
            await firebaseReady;
            const db = getFirestoreDB();
            try {
                await deleteDoc(doc(db, "subscribers", id));
                showToast("구독자가 삭제되었습니다.");
            } catch (error) {
                console.error("구독자 삭제 실패:", error);
                showToast("삭제에 실패했습니다.", true);
            }
        }
    }
};