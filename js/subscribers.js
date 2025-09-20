// js/subscribers.js (v2.0 - 메모 & 다운로드 기능 추가)

import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
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
        this.ui.listContainer.addEventListener('click', (event) => {
            if (event.target.classList.contains('delete-subscriber-button')) {
                const id = event.target.dataset.id;
                this.handleDeleteSubscriber(id);
            }
            if (event.target.classList.contains('save-memo-button')) {
                const id = event.target.dataset.id;
                this.handleSaveMemo(id);
            }
        });

        // 다운로드 버튼은 render 함수에서 생성되므로, statsContainer에 이벤트 위임을 사용합니다.
        this.ui.statsContainer.addEventListener('click', (event) => {
            if (event.target.id === 'download-csv-button') {
                this.handleDownloadCSV();
            }
        });
    },

    async listen() {
        await firebaseReady;
        const db = getFirestoreDB();
        const q = query(collection(db, "subscribers"), orderBy("subscribedAt", "desc"));
        
        onSnapshot(q, (querySnapshot) => {
            this.list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.render();
        });
    },

    render() {
        if (!this.ui.listContainer || !this.ui.statsContainer) return;

        // 통계 및 다운로드 버튼 렌더링
        this.ui.statsContainer.innerHTML = `
            <div class="flex justify-between items-center">
                <p class="text-lg text-slate-300">총 <span class="font-bold text-emerald-400">${this.list.length}</span>명의 구독자가 있습니다.</p>
                <button id="download-csv-button" class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 shadow-md transition-colors">
                    CSV 다운로드
                </button>
            </div>
        `;

        // 리스트 테이블 렌더링
        let tableHTML = `
            <div class="overflow-x-auto">
                <table class="w-full text-sm text-left text-slate-400">
                    <thead class="text-xs text-slate-300 uppercase bg-slate-700">
                        <tr>
                            <th scope="col" class="px-6 py-3">이메일</th>
                            <th scope="col" class="px-6 py-3">구독일</th>
                            <th scope="col" class="px-6 py-3 w-1/3">메모</th>
                            <th scope="col" class="px-6 py-3 text-right">관리</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        if (this.list.length === 0) {
            tableHTML += `<tr><td colspan="4" class="px-6 py-8 text-center">구독자가 없습니다.</td></tr>`;
        } else {
            this.list.forEach(subscriber => {
                const subscribedDate = subscriber.subscribedAt?.toDate ? subscriber.subscribedAt.toDate() : new Date();
                const formattedDate = subscribedDate.toLocaleString('ko-KR', {
                    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                });

                tableHTML += `
                    <tr class="bg-slate-800 border-b border-slate-700 hover:bg-slate-600 align-top">
                        <td class="px-6 py-4 font-medium text-white">${subscriber.email}</td>
                        <td class="px-6 py-4">${formattedDate}</td>
                        <td class="px-6 py-4">
                            <textarea id="memo-input-${subscriber.id}" class="memo-textarea" placeholder="메모를 입력하세요...">${subscriber.memo || ''}</textarea>
                            <button data-id="${subscriber.id}" class="save-memo-button">저장</button>
                        </td>
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

    async handleSaveMemo(id) {
        if (!id) return;
        const memoInput = document.getElementById(`memo-input-${id}`);
        const memoText = memoInput.value.trim();
        
        await firebaseReady;
        const db = getFirestoreDB();
        try {
            await updateDoc(doc(db, "subscribers", id), { memo: memoText });
            showToast("메모가 저장되었습니다.");
        } catch (error) {
            console.error("메모 저장 실패:", error);
            showToast("메모 저장에 실패했습니다.", true);
        }
    },

    handleDownloadCSV() {
        if (this.list.length === 0) {
            showToast("다운로드할 구독자가 없습니다.", true);
            return;
        }

        // CSV 데이터 생성 (헤더 포함)
        let csvContent = "Email,Subscribed At,Memo\n";
        
        this.list.forEach(subscriber => {
            const date = subscriber.subscribedAt?.toDate ? subscriber.subscribedAt.toDate().toISOString() : '';
            
            // CSV 형식에 맞게 데이터 정제 (따옴표, 쉼표 처리)
            const email = `"${subscriber.email || ''}"`;
            const memo = `"${(subscriber.memo || '').replace(/"/g, '""')}"`;

            csvContent += [email, date, memo].join(',') + "\n";
        });

        // 파일 다운로드
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        const today = new Date();
        const filename = `subscribers_${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}.csv`;
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("CSV 파일 다운로드가 시작됩니다.");
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