// js/index_script.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy, doc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// ===============================================================
// 🚀 정부 지원사업 알리미 v2.0
// ===============================================================
// [변경점]
// 1. JavaScript 코드를 index.html에서 완전히 분리!
// 2. 브라우저 캐싱 및 defer 로딩을 통해 2차 방문부터 로딩 속도 향상.
// ===============================================================

let db;

// --- 상태 관리 변수 ---
let favorites = [], comparisonList = [], alertKeywords = [], seenItems = [], allApiDataForUtils = [], adDataList = [];
let currentFilters = { searchTerm: '', region: 'all', category: [], sort: 'default', showFavorites: false };
let currentPage = 1;
let totalItems = 0;
let isLoading = false;
let searchTimeout;
let renderedItemCount = 0;
let adIndex = 0;

// --- DOM 요소 ---
const elements = { 
    statusContainer: document.getElementById('status-container'), 
    errorMessage: document.getElementById('error-message'), 
    resultsContainer: document.getElementById('results-container'), 
    searchInput: document.getElementById('search-input'), 
    sortButtons: document.getElementById('sort-buttons'),
    regionSelect: document.getElementById('region-select'), 
    categoryCheckboxContainer: document.getElementById('category-checkbox-container'), 
    activeFiltersContainer: document.getElementById('active-filters-container'), 
    favoritesToggle: document.getElementById('favorites-toggle'), 
    compareButton: document.getElementById('compare-button'), 
    loadMoreSpinner: document.getElementById('load-more-spinner'),
    modal: document.getElementById('comparison-modal'), 
    modalBg: document.getElementById('comparison-modal-bg'), 
    closeModalButton: document.getElementById('close-modal-button'), 
    comparisonContent: document.getElementById('comparison-content'), 
    toast: document.getElementById('toast-notification'), 
    stickyHeaderContainer: document.getElementById('sticky-header-container'),
    toggleFiltersButton: document.getElementById('toggle-filters-button'), 
    collapsibleFilters: document.getElementById('collapsible-filters'),
    keywordInput: document.getElementById('keyword-input'), 
    addKeywordButton: document.getElementById('add-keyword-button'), 
    keywordTagsContainer: document.getElementById('keyword-tags-container'), 
    keywordAlertModal: document.getElementById('keyword-alert-modal'), 
    keywordAlertContent: document.getElementById('keyword-alert-content'), 
    closeKeywordAlertButton: document.getElementById('close-keyword-alert-button'),
};

// --- 앱 시작점 ---
document.addEventListener('DOMContentLoaded', startApp);

async function startApp() {
  try {
      console.log("🚀 [v2.0] 앱 실행 시작!");
      const response = await fetch('/.netlify/functions/get-firebase-config');
      if (!response.ok) throw new Error(`비밀요원 응답 실패! 상태: ${response.status}`);
      const firebaseConfig = await response.json();
      
      const app = initializeApp(firebaseConfig);
      db = getFirestore(app);
      console.log("✅ [v2.0] Firebase 앱 초기화 및 Firestore DB 연결 성공!");

      await initialize();
  } catch (error) {
      handleError("🔥 [치명적 오류] 앱 시작 중 문제 발생:", error.message);
  }
}

async function initialize() {
    addEventListeners();
    
    await loadAdData();
    
    favorites = JSON.parse(localStorage.getItem('favorites')) || [];
    alertKeywords = JSON.parse(localStorage.getItem('alertKeywords')) || [];
    seenItems = JSON.parse(localStorage.getItem('seenItems')) || [];
    
    updateFavoritesButtonVisibility(); 
    renderAlertKeywords();
    
    const firstRenderPromise = fetchAndRenderData(true);
    populateFilters();

    await firstRenderPromise;
    console.log("[v2.0] ✅ 첫 화면 렌더링 로직 완료!");
}

async function loadAdData() {
    try {
        const q = query(collection(db, "adv"), orderBy("order", "asc"));
        const querySnapshot = await getDocs(q);
        const rawAdData = [];
        querySnapshot.forEach((doc) => {
            rawAdData.push({ id: doc.id, ...doc.data(), isAd: true });
        });

        const now = new Date();
        adDataList = rawAdData.filter(ad => {
            if (ad.isActive === false) return false;
            const start = ad.startDate ? new Date(ad.startDate) : null;
            const end = ad.endDate ? new Date(ad.endDate) : null;
            if (start && now < start) return false;
            if (end && now > end) return false;
            return true;
        });
        console.log(`[v2.0] 📢 활성 광고 ${adDataList.length}개 로드 완료!`);
    } catch (error) {
        console.error("[v2.0] 🔥 광고 데이터 로딩 실패:", error);
        adDataList = [];
    }
}

// --- 데이터 요청 및 렌더링 ---
async function fetchAndRenderData(isNewSearch = false) {
    if (isLoading) return;
    isLoading = true;

    if (isNewSearch) {
        currentPage = 1;
        renderedItemCount = 0;
        adIndex = 0;
        elements.resultsContainer.innerHTML = '';
        renderSkeletonUI();
        elements.errorMessage.classList.add('hidden');
    } else {
        elements.loadMoreSpinner.classList.remove('hidden');
    }
    
    let query = `page=${currentPage}&perPage=12`;
    if (currentFilters.searchTerm) query += `&searchTerm=${encodeURIComponent(currentFilters.searchTerm)}`;
    if (currentFilters.region !== 'all') query += `&region=${encodeURIComponent(currentFilters.region)}`;
    if (currentFilters.category.length > 0) query += `&category=${encodeURIComponent(currentFilters.category.join(','))}`;
    if (currentFilters.showFavorites && favorites.length > 0) {
        query += `&favorites=${favorites.join(',')}`;
    }
    
    console.log(`[v2.0 프론트엔드] 📡 백엔드에 데이터 요청 시작... 조건: ${query}`);

    try {
        const response = await fetch(`/.netlify/functions/get-support-data?${query}`);
        if (!response.ok) throw new Error(`서버 응답 오류: ${response.status}`);
        const { data, totalItems: newTotalItems } = await response.json();
        
        totalItems = newTotalItems;
        elements.statusContainer.innerHTML = '';

        if (data && data.length > 0) {
            appendData(data);
        } else if (isNewSearch) {
            const message = currentFilters.showFavorites ? '즐겨찾기한 사업이 없습니다.' : '조건에 맞는 사업이 없습니다.';
            elements.resultsContainer.innerHTML = `<p class="col-span-full text-center text-slate-500">${message}</p>`;
        }
        renderActiveFilters();
    } catch (error) {
        handleError("데이터 요청 오류:", error.message);
    } finally {
        isLoading = false;
        elements.statusContainer.innerHTML = '';
        elements.loadMoreSpinner.classList.add('hidden');
    }
}

function appendData(items) {
    let contentToAdd = '';
    items.forEach(item => {
        contentToAdd += createItemHTML(item);
        if (!item.isAd) { // 광고가 아닐 때만 공고 카운트 증가
            renderedItemCount++;
        }
        
        if (adDataList.length > 0 && renderedItemCount > 0 && renderedItemCount % 7 === 0) {
            if (elements.resultsContainer.querySelectorAll('.ad-card').length <= Math.floor(renderedItemCount / 7)) {
                const ad = adDataList[adIndex % adDataList.length];
                if (ad) {
                   contentToAdd += createItemHTML(ad);
                   adIndex++;
                }
            }
        }
    });
    elements.resultsContainer.insertAdjacentHTML('beforeend', contentToAdd);
}

async function populateFilters() {
      try {
          const response = await fetch(`/.netlify/functions/get-support-data?perPage=500`);
          if (!response.ok) throw new Error(`필터 데이터 로딩 실패: ${response.status}`);
          const result = await response.json();
          allApiDataForUtils = result.data || [];

          const regionCounts = {}, categoryCounts = {};
          allApiDataForUtils.forEach(item => {
              if (item.supt_regin) regionCounts[item.supt_regin] = (regionCounts[item.supt_regin] || 0) + 1;
              if (item.supt_biz_clsfc) categoryCounts[item.supt_biz_clsfc] = (categoryCounts[item.supt_biz_clsfc] || 0) + 1;
          });

          elements.regionSelect.innerHTML = '<option value="all">모든 지역 ('+ allApiDataForUtils.length +')</option>';
          Object.keys(regionCounts).sort((a, b) => a.localeCompare(b, 'ko')).forEach(region => {
              const option = document.createElement('option');
              option.value = region;
              option.textContent = `${region} (${regionCounts[region]})`;
              elements.regionSelect.appendChild(option);
          });

          elements.categoryCheckboxContainer.innerHTML = '';
          Object.keys(categoryCounts).sort((a, b) => a.localeCompare(b, 'ko')).forEach(category => {
              const label = document.createElement('label');
              label.className = 'flex items-center space-x-2 text-sm cursor-pointer hover:bg-sky-50 p-1 rounded';
              label.innerHTML = `<input type="checkbox" class="category-checkbox" value="${category}"><span>${category.includes('기술개발(R&D)') ? '기술개발' : category} (${categoryCounts[category]})</span>`;
              elements.categoryCheckboxContainer.appendChild(label);
          });
          
          elements.regionSelect.disabled = false;
      } catch(error) {
          console.error("[v2.0] 🔥 필터 UI 생성 실패", error);
          elements.regionSelect.innerHTML = '<option value="all">옵션 로딩 실패</option>';
          elements.categoryCheckboxContainer.innerHTML = '<p class="filter-placeholder">옵션 로딩 실패</p>';
          elements.regionSelect.disabled = false;
      }
}

// --- 이벤트 리스너 ---
function addEventListeners() {
    window.addEventListener('scroll', handleScroll);
    
    elements.searchInput.addEventListener('input', e => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentFilters.searchTerm = e.target.value.toLowerCase();
            fetchAndRenderData(true);
        }, 300);
    });

    elements.regionSelect.addEventListener('change', e => {
        currentFilters.region = e.target.value;
        fetchAndRenderData(true);
    });
    
    elements.categoryCheckboxContainer.addEventListener('change', e => {
        if (e.target.classList.contains('category-checkbox')) {
            currentFilters.category = Array.from(elements.categoryCheckboxContainer.querySelectorAll('.category-checkbox:checked')).map(cb => cb.value);
            fetchAndRenderData(true);
        }
    });
    
    elements.favoritesToggle.addEventListener('click', e => { 
        currentFilters.showFavorites = !currentFilters.showFavorites; 
        e.target.classList.toggle('active'); 
        e.target.innerHTML = currentFilters.showFavorites ? '★ 전체 목록 보기' : '☆ 즐겨찾기 보기'; 
        fetchAndRenderData(true); 
    });

    elements.resultsContainer.addEventListener('click', e => {
          const adLink = e.target.closest('.ad-link');
          if (adLink) {
              e.preventDefault();
              const adId = adLink.dataset.id;
              const adUrl = adLink.href;
              if (adId) handleAdClick(adId);
              window.open(adUrl, '_blank');
              return;
          }

          const button = e.target.closest('button');
          if (button) {
              if (button.classList.contains('favorite-button')) toggleFavorite(button);
              if (button.classList.contains('share-button')) shareLink(button);
              if (button.classList.contains('details-toggle')) toggleDetails(button);
          }
          const checkbox = e.target.closest('.compare-checkbox');
          if (checkbox) toggleComparison(checkbox);
      });

      elements.compareButton.addEventListener('click', showComparisonModal);
      elements.modalBg.addEventListener('click', () => elements.modal.classList.add('hidden'));
      elements.closeModalButton.addEventListener('click', () => elements.modal.classList.add('hidden'));
      elements.toggleFiltersButton.addEventListener('click', () => elements.collapsibleFilters.classList.toggle('expanded'));
      elements.addKeywordButton.addEventListener('click', addKeyword);
      elements.keywordInput.addEventListener('keypress', e => { if (e.key === 'Enter') addKeyword(); });
      elements.keywordTagsContainer.addEventListener('click', handleKeywordTagClick);
      elements.closeKeywordAlertButton.addEventListener('click', () => elements.keywordAlertModal.classList.add('hidden'));

      document.addEventListener('click', function(event) {
          if (elements.collapsibleFilters.classList.contains('expanded')) {
              const isClickInsideHeader = elements.stickyHeaderContainer.contains(event.target);
              if (!isClickInsideHeader) {
                  elements.collapsibleFilters.classList.remove('expanded');
              }
          }
      });
}

async function handleAdClick(adId) {
    try {
        const adRef = doc(db, "adv", adId);
        await updateDoc(adRef, { clickCount: increment(1) });
        console.log(`[v2.0] 📢 광고 클릭 카운트 업데이트 성공: ${adId}`);
    } catch (error) {
        console.error("[v2.0] 🔥 광고 클릭 카운트 업데이트 실패:", error);
    }
}

function handleScroll() {
    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    const itemsOnScreen = elements.resultsContainer.children.length;
    // totalItems는 필터링된 '공고' 수, itemsOnScreen은 '공고+광고' 수
    // 스크롤 판단은 공고 수 기준으로 해야 정확
    if (clientHeight + scrollTop >= scrollHeight - 100 && !isLoading && renderedItemCount < totalItems) {
        currentPage++;
        fetchAndRenderData(false);
    }
}

function handleError(context, message) {
    console.error(context, message);
    elements.statusContainer.innerHTML = '';
    elements.loadMoreSpinner.classList.add('hidden');
    elements.errorMessage.textContent = `${context} ${message}`;
    elements.errorMessage.classList.remove('hidden');
}

function renderSkeletonUI() {
    const skeletonHTML = `
      <div class="bg-white rounded-xl shadow-md p-6 space-y-4">
          <div class="animate-pulse flex justify-between items-center"><div class="h-4 bg-slate-200 rounded w-1/3"></div><div class="h-4 bg-slate-200 rounded w-1/4"></div></div>
          <div class="animate-pulse h-6 bg-slate-200 rounded w-full"></div>
          <div class="animate-pulse h-4 bg-slate-200 rounded w-1/2"></div>
          <div class="border-t pt-4 mt-4 flex justify-between items-center"><div class="animate-pulse h-4 bg-slate-200 rounded w-1/4"></div><div class="animate-pulse h-4 bg-slate-200 rounded w-1/4"></div></div>
      </div>`.repeat(3);
    elements.statusContainer.innerHTML = skeletonHTML;
}

function createItemHTML(item) {
    if (item.isAd) {
        let mediaElement = '';
        if (item.mediaUrl) {
            mediaElement = item.mediaType === 'video'
                ? `<video autoplay loop muted playsinline src="${item.mediaUrl}"></video>`
                : `<img src="${item.mediaUrl}" alt="${item.title}" loading="lazy">`;
        }
        return `
        <div class="ad-card bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow overflow-hidden relative flex flex-col">
            <a href="${item.link}" target="_blank" data-id="${item.id}" class="ad-link block">
                <div class="ad-media-container">${mediaElement}</div>
            </a>
            <div class="p-4 flex-grow flex flex-col">
                <div class="flex justify-between items-start">
                     <span class="text-sm font-semibold text-slate-600 uppercase tracking-wide">Sponsored</span>
                     <span class="text-slate-600 text-xs font-bold rounded-full px-3 py-1 bg-slate-200">AD</span>
                </div>
                <a href="${item.link}" target="_blank" data-id="${item.id}" class="ad-link block mt-2 text-lg leading-tight font-bold text-slate-800 hover:underline">${item.title}</a>
                <p class="mt-2 text-slate-600 text-sm flex-grow">${item.description || ''}</p>
                <div class="mt-4 pt-4 border-t text-right">
                     <a href="${item.link}" target="_blank" data-id="${item.id}" class="ad-link text-sm font-semibold text-sky-600 hover:underline">자세히 보기 &rarr;</a>
                </div>
            </div>
        </div>`;
    }

    const dday = calculateDday(item.pbanc_rcpt_end_dt); 
    const isFavorited = favorites.includes(item.pbanc_sn); 
    const isChecked = comparisonList.includes(item.pbanc_sn) ? 'checked' : ''; 
    const isNew = isWithinLast7Days(item.pbanc_rcpt_bgng_dt); 
    return `
        <div class="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow overflow-hidden relative">
            ${isNew ? '<span class="new-badge absolute top-0 right-0 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-bl-lg">NEW</span>' : ''}
            <div class="p-6">
                <div class="flex justify-between items-start">
                    <span class="text-sm font-semibold text-sky-600 uppercase tracking-wide">${item.pbanc_ntrp_nm || '기관명 없음'}</span>
                    <span class="text-white text-xs font-bold rounded-full px-3 py-1 ${dday.className}">${dday.text}</span>
                </div>
                <a href="${item.detl_pg_url}" target="_blank" class="block mt-2 text-xl leading-tight font-bold text-slate-800 hover:underline">${item.biz_pbanc_nm || '공고 제목 없음'}</a>
                <p class="mt-2 text-slate-500 text-sm"><strong>접수기간:</strong> ${item.pbanc_rcpt_bgng_dt || '?'} ~ ${item.pbanc_rcpt_end_dt || '?'}</p>
                <div class="details-content mt-4 pt-4 border-t text-sm text-slate-600 space-y-2">
                    <p><strong>- 신청대상:</strong> ${item.aply_trgt_ctnt || '상세 정보 없음'}</p>
                </div>
                <div class="flex justify-between items-center mt-4 pt-4 border-t">
                    <div class="flex items-center gap-4">
                        <label class="flex items-center space-x-2 text-sm cursor-pointer"><input type="checkbox" class="compare-checkbox" data-id="${item.pbanc_sn}" ${isChecked}><span>비교</span></label>
                        <button class="details-toggle text-sm font-semibold text-sky-600 hover:underline">자세히 보기 ▼</button>
                    </div>
                    <div>
                        <button class="share-button text-slate-400 hover:text-sky-500 transition-colors" data-url="${item.detl_pg_url}" title="공유하기"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6.002l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367-2.684zm0 9.318a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"></path></svg></button>
                        <button class="favorite-button text-2xl text-slate-400 hover:text-amber-400 transition-colors ${isFavorited ? 'favorited' : ''}" data-id="${item.pbanc_sn}">${isFavorited ? '★' : '☆'}</button>
                    </div>
                </div>
            </div>
        </div>`;
}

function renderActiveFilters() {
    let html = ''; 
    if (currentFilters.searchTerm) html += `<span class="active-filter-tag" data-type="searchTerm">검색: ${currentFilters.searchTerm} <button>x</button></span>`; 
    if (currentFilters.region !== 'all') html += `<span class="active-filter-tag" data-type="region">지역: ${currentFilters.region} <button>x</button></span>`; 
    if (currentFilters.category.length > 0) {
        currentFilters.category.forEach(cat => { html += `<span class="active-filter-tag" data-type="category" data-value="${cat}">분야: ${cat} <button>x</button></span>`; });
    }
    if (html) { html += `<button id="reset-filters-button" class="text-sm text-red-500 hover:underline ml-auto">모든 필터 초기화</button>`; } 
    elements.activeFiltersContainer.innerHTML = html; 
    
    elements.activeFiltersContainer.querySelectorAll('.active-filter-tag button').forEach(btn => btn.addEventListener('click', e => { 
        const tagElement = e.target.parentElement;
        resetFilter(tagElement.dataset.type, tagElement.dataset.value); 
    })); 
    if(document.getElementById('reset-filters-button')) { 
        document.getElementById('reset-filters-button').addEventListener('click', resetAllFilters); 
    } 
}

function resetFilter(type, value) {
    if (type === 'searchTerm') { currentFilters.searchTerm = ''; elements.searchInput.value = ''; }
    else if (type === 'region') { currentFilters.region = 'all'; elements.regionSelect.value = 'all'; }
    else if (type === 'category') {
        currentFilters.category = currentFilters.category.filter(cat => cat !== value);
        const checkbox = elements.categoryCheckboxContainer.querySelector(`.category-checkbox[value="${value}"]`);
        if (checkbox) checkbox.checked = false;
    }
    fetchAndRenderData(true);
}

function resetAllFilters() {
    currentFilters = { searchTerm: '', region: 'all', category: [], sort: 'default', showFavorites: false };
    elements.searchInput.value = ''; 
    elements.regionSelect.value = 'all';
    elements.categoryCheckboxContainer.querySelectorAll('.category-checkbox:checked').forEach(checkbox => checkbox.checked = false);
    fetchAndRenderData(true);
}

function calculateDday(endDateStr) { if (!endDateStr) return { text: "정보 없음", className: "bg-slate-500", days: 9999 }; const [year, month, day] = [parseInt(endDateStr.substring(0, 4)), parseInt(endDateStr.substring(4, 6)) - 1, parseInt(endDateStr.substring(6, 8))]; const today = new Date(); today.setHours(0, 0, 0, 0); const endDate = new Date(year, month, day); const diffDays = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24)); if (diffDays < 0) return { text: "마감", className: "bg-slate-700", days: 9999 + diffDays }; if (diffDays === 0) return { text: "D-Day", className: "bg-red-500", days: 0 }; if (diffDays <= 7) return { text: `D-${diffDays}`, className: "bg-orange-500", days: diffDays }; return { text: `D-${diffDays}`, className: "bg-green-600", days: diffDays }; }
function isWithinLast7Days(dateStr) { if (!dateStr) return false; const [year, month, day] = [parseInt(dateStr.substring(0, 4)), parseInt(dateStr.substring(4, 6)) - 1, parseInt(dateStr.substring(6, 8))]; const itemDate = new Date(year, month, day); const today = new Date(); const sevenDaysAgo = new Date(new Date().setDate(new Date().getDate() - 7)); return itemDate >= sevenDaysAgo && itemDate <= new Date(); }
function toggleDetails(button) { const content = button.closest('.p-6').querySelector('.details-content'); content.classList.toggle('expanded'); button.textContent = content.classList.contains('expanded') ? '간략히 보기 ▲' : '자세히 보기 ▼'; }
function toggleFavorite(button) { const id = parseInt(button.dataset.id); const index = favorites.indexOf(id); if (index > -1) { favorites.splice(index, 1); button.classList.remove('favorited'); button.textContent = '☆'; } else { favorites.push(id); button.classList.add('favorited'); button.textContent = '★'; } localStorage.setItem('favorites', JSON.stringify(favorites)); updateFavoritesButtonVisibility(); if (currentFilters.showFavorites) { fetchAndRenderData(true); } }
function toggleComparison(checkbox) { const id = parseInt(checkbox.dataset.id); const index = comparisonList.indexOf(id); if (index > -1) { comparisonList.splice(index, 1); } else { comparisonList.push(id); } elements.compareButton.classList.toggle('hidden', comparisonList.length === 0); }
function updateFavoritesButtonVisibility() { elements.favoritesToggle.classList.toggle('hidden', favorites.length === 0); if (favorites.length === 0 && currentFilters.showFavorites) { currentFilters.showFavorites = false; elements.favoritesToggle.classList.remove('active'); elements.favoritesToggle.innerHTML = '☆ 즐겨찾기 보기'; fetchAndRenderData(true); } }
function showComparisonModal() { const itemsToCompare = allApiDataForUtils.filter(item => comparisonList.includes(item.pbanc_sn)); const headers = { biz_pbanc_nm: "공고 제목", pbanc_ntrp_nm: "주관 기관", supt_regin: "지원 지역", supt_biz_clsfc: "사업 분야", aply_trgt_ctnt: "신청 대상" }; let tableHTML = '<div class="overflow-x-auto"><table class="w-full text-sm text-left table-fixed"><thead><tr class="bg-slate-100"><th class="p-2 w-1/5">항목</th>'; itemsToCompare.forEach(item => tableHTML += `<th class="p-2 w-2/5">${(item.biz_pbanc_nm || '').substring(0, 20)}...</th>`); tableHTML += '</tr></thead><tbody>'; Object.keys(headers).forEach(key => { tableHTML += `<tr class="border-b"><td class="font-bold p-2 align-top">${headers[key]}</td>`; itemsToCompare.forEach(item => tableHTML += `<td class="p-2 align-top break-words">${item[key] || '-'}</td>`); tableHTML += '</tr>'; }); tableHTML += '</tbody></table></div>'; elements.comparisonContent.innerHTML = tableHTML; elements.modal.classList.remove('hidden'); }
function shareLink(button) { const url = button.dataset.url; navigator.clipboard.writeText(url).then(() => showToast("링크가 복사되었습니다!"), () => showToast("링크 복사에 실패했습니다.", true)); }
function showToast(message, isError = false) { elements.toast.textContent = message; elements.toast.className = `fixed bottom-10 right-10 text-white px-6 py-3 rounded-lg shadow-lg opacity-0 transform translate-y-4 ${isError ? 'bg-red-500' : 'bg-slate-800'}`; requestAnimationFrame(() => { elements.toast.classList.remove('opacity-0', 'translate-y-4'); }); setTimeout(() => { elements.toast.classList.add('opacity-0', 'translate-y-4'); }, 2000); }
function addKeyword() { const keyword = elements.keywordInput.value.trim(); if (keyword && !alertKeywords.includes(keyword)) { alertKeywords.push(keyword); localStorage.setItem('alertKeywords', JSON.stringify(alertKeywords)); renderAlertKeywords(); elements.keywordInput.value = ''; } }
function renderAlertKeywords() { elements.keywordTagsContainer.innerHTML = alertKeywords.length === 0 ? '<span class="text-xs text-slate-400">알림 받을 키워드를 추가해보세요.</span>' : alertKeywords.map((keyword, index) => `<span class="keyword-tag">${keyword} <button data-index="${index}">x</button></span>`).join(''); }
function handleKeywordTagClick(e) { if (e.target.tagName === 'BUTTON') { const index = parseInt(e.target.dataset.index); alertKeywords.splice(index, 1); localStorage.setItem('alertKeywords', JSON.stringify(alertKeywords)); renderAlertKeywords(); } }
function checkNewItemsForKeywords() { if (alertKeywords.length === 0 || allApiDataForUtils.length === 0) return; const currentItemIds = allApiDataForUtils.map(item => item.pbanc_sn); const newItems = allApiDataForUtils.filter(item => !seenItems.includes(item.pbanc_sn)); if (newItems.length > 0) { const matchedItems = []; newItems.forEach(item => { const title = item.biz_pbanc_nm || ''; const matchedKeyword = alertKeywords.find(keyword => title.toLowerCase().includes(keyword.toLowerCase())); if (matchedKeyword) { matchedItems.push({ item, keyword: matchedKeyword }); } }); if (matchedItems.length > 0) { showKeywordAlertDialog(matchedItems); } } localStorage.setItem('seenItems', JSON.stringify(currentItemIds)); seenItems = currentItemIds; }
function showKeywordAlertDialog(matchedItems) { elements.keywordAlertContent.innerHTML = matchedItems.map(({item, keyword}) => `<div class="mb-4 p-3 border rounded-lg hover:bg-slate-50"><p class="text-sm text-slate-500"><span class="font-bold text-sky-600">[${keyword}]</span> 키워드와 일치하는 새 공고!</p><a href="${item.detl_pg_url}" target="_blank" class="font-bold text-slate-800 hover:underline">${item.biz_pbanc_nm}</a></div>`).join(''); elements.keywordAlertModal.classList.remove('hidden'); }