/* ============================================================
 *  exchange.js — 거래소 탭 (종목 리스트 + 정렬 + 스마트 스케줄)
 *  읽기 최적화: 전체 로드 1회 + 캐시 갱신 (1 read/refresh)
 * ============================================================ */

const Exchange = {
  currentSort: 'all',
  searchQuery: '',
  _timer: null,

  /* ── 전체 종목 로드 (84 reads, 로그인 시 1회) + 캐시 병합 ── */
  async loadFull() {
    try {
      const snap = await App.db.collection(CONFIG.COLLECTIONS.STOCKS).get();
      App.stocks = [];
      snap.forEach(doc => App.stocks.push({ id: doc.id, ...doc.data() }));

      // 캐시에서 최신 가격 즉시 병합 (+1 read)
      await this.refreshFromCache();

      this.render();
      AppUI.updateHeader();
    } catch (e) {
      console.error('종목 로드 오류:', e);
    }
  },

  /* ── 캐시에서 가격만 갱신 + 설정 재로드 + 필요시 시세 가져오기 ── */
  async refreshFromCache() {
    try {
      // 관리자 설정 재로드 (강제 개장/폐장 반영)
      try {
        const cfgDoc = await App.db.collection(CONFIG.COLLECTIONS.CONFIG).doc('settings').get();
        if (cfgDoc.exists) {
          const d = cfgDoc.data();
          App.config.marketOverride = d.marketOverride != null ? d.marketOverride : null;
        }
      } catch (e) { /* 설정 읽기 실패해도 계속 진행 */ }

      const doc = await App.db.collection(CONFIG.COLLECTIONS.CONFIG).doc('priceCache').get();

      // 캐시가 오래됐으면 이 클라이언트가 시세 가져오기 (쓰기 담당)
      if (PriceFetch.isConfigured()) {
        const schedule = Utils.getRefreshSchedule();
        if (schedule.mode !== 'sleep' && schedule.mode !== 'idle') {
          const staleMin = Math.max(schedule.interval, 10); // 간격만큼 지나면 갱신
          let isStale = true;

          if (doc.exists && doc.data().updatedAt) {
            const lastUpdate = doc.data().updatedAt.toDate();
            const ageMin = (Date.now() - lastUpdate.getTime()) / 60000;
            isStale = ageMin > staleMin;
          }

          if (isStale) {
            console.log('캐시 오래됨 → 시세 가져오기 실행');
            await PriceFetch.fetchPrices();
            // 새로 가져온 캐시 다시 읽기
            const freshDoc = await App.db.collection(CONFIG.COLLECTIONS.CONFIG).doc('priceCache').get();
            if (freshDoc.exists) {
              this._mergePrices(freshDoc.data().prices || {}, freshDoc.data().updatedAt);
            }
            return;
          }
        }
      }

      // 캐시가 신선하면 그냥 사용
      if (doc.exists) {
        this._mergePrices(doc.data().prices || {}, doc.data().updatedAt);
      }
    } catch (e) {
      console.error('캐시 갱신 오류:', e);
    }
  },

  /* 가격 데이터 병합 */
  _mergePrices(prices, updatedAt) {
    App.stocks.forEach(s => {
      const p = prices[s.code];
      if (p) {
        s.price = p.price;
        s.prevClose = p.prevClose;
        s.change = p.change;
        s.changePct = p.changePct;
        if (p.volume) s.volume = p.volume;
        if (p.per != null) s.per = p.per;
      }
    });
    // 시세 업데이트 시각 표시
    const timeEl = document.getElementById('priceUpdateTime');
    if (timeEl && updatedAt) {
      const t = updatedAt.toDate ? updatedAt.toDate() : new Date(updatedAt);
      timeEl.textContent = '📡 ' + t.toLocaleTimeString('ko-KR', {hour:'2-digit',minute:'2-digit'});
    }
    this.render();
    if (typeof AppUI !== 'undefined') AppUI.updateHeader();
    if (typeof Chart !== 'undefined') Chart.cache = {};
  },

  /* ── 스마트 스케줄 시작 ── */
  startSmartRefresh() {
    this.loadFull();
    this._scheduleNext();
  },

  _scheduleNext() {
    if (this._timer) clearTimeout(this._timer);

    const schedule = Utils.getRefreshSchedule();

    if (schedule.mode === 'sleep') {
      this.render();
      this._timer = setTimeout(() => this._scheduleNext(), 30 * 60000);
      return;
    }

    if (schedule.mode === 'idle') {
      // 16:40~22:00: 시세 정지, 종목은 보임, 30분마다 재확인
      this._timer = setTimeout(() => this._scheduleNext(), 30 * 60000);
      return;
    }

    this.render();
    const ms = schedule.interval * 60000;

    this._timer = setTimeout(async () => {
      await this.refreshFromCache();
      this._scheduleNext();
    }, ms);
  },

  stopRefresh() {
    if (this._timer) clearTimeout(this._timer);
  },

  /* ── 거래소 탭 렌더링 ── */
  render() {
    const el = document.getElementById('exchangeContent');
    if (!el) return;

    // 수면 시간이면 종목 리스트 + 정렬 탭 숨기기
    const schedule = Utils.getRefreshSchedule();
    const sortTabs = document.querySelector('#page-exchange .sort-tabs');
    const searchBar = document.getElementById('stockSearch');

    if (schedule.mode === 'sleep') {
      if (sortTabs) sortTabs.style.display = 'none';
      if (searchBar) searchBar.style.display = 'none';
      el.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--text2);font-size:15px;line-height:2;">💤<br><b style="font-size:20px;color:var(--text);">거래소 휴식중</b><br>오전 8시에 다시 열려요!<br><span style="font-size:13px;">22:00~08:00은 시세 반영이 멈춰요</span></div>';
      return;
    }
    if (sortTabs) sortTabs.style.display = 'flex';
    if (searchBar) searchBar.style.display = 'block';

    const stocks = this.getSortedStocks();
    if (stocks.length === 0) {
      el.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--text2);">종목이 없어요. 관리자에게 문의하세요.</div>';
      return;
    }

    el.innerHTML = stocks.map(s => {
      const d = Utils.dir(s.change);
      const arrow = Utils.arrow(s.change);
      return `<div class="stock-item" onclick="Detail.open('${s.code}')">
        <div>
          <div class="stock-name">${Utils.esc(s.name)}</div>
          <div class="stock-code">${s.code}</div>
        </div>
        <div>
          <div class="stock-price ${d}">${Utils.formatWon(s.price)}</div>
          <div class="stock-change ${d}">${arrow} ${Utils.formatNum(Math.abs(s.change || 0))} (${Utils.formatPct(s.changePct)})</div>
        </div>
      </div>`;
    }).join('');
  },

  /* 정렬된 종목 배열 반환 */
  getSortedStocks() {
    let stocks = [...App.stocks];

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      stocks = stocks.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.code.includes(q) ||
        (s.sector && s.sector.includes(q))
      );
    }

    switch (this.currentSort) {
      case 'up':
        stocks.sort((a, b) => (b.changePct || 0) - (a.changePct || 0));
        break;
      case 'down':
        stocks.sort((a, b) => (a.changePct || 0) - (b.changePct || 0));
        break;
      case 'volume':
        stocks.sort((a, b) => (b.volume || 0) - (a.volume || 0));
        break;
      case 'price-low':
        stocks.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case 'price-high':
        stocks.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case 'fav':
        const favs = JSON.parse(localStorage.getItem('sl_favs') || '[]');
        stocks = stocks.filter(s => favs.includes(s.code));
        break;
      default:
        stocks.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    }
    return stocks;
  },

  /* 정렬 탭 변경 */
  setSort(sort, el) {
    this.currentSort = sort;
    document.querySelectorAll('.sort-tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    this.render();
  }
};
