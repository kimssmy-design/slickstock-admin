/* ============================================================
 *  price-fetch.js — Google Sheets → Firestore 실시간 시세 연동
 *  5분마다 자동으로 시세를 가져와 Firestore를 업데이트합니다
 * ============================================================ */

const PriceFetch = {
  _timer: null,
  lastUpdate: null,

  /* 시세 가져오기 (메인) */
  async fetchPrices() {
    const url = CONFIG.SHEET_CSV_URL;
    if (!url || url.includes('YOUR_')) {
      console.log('Google Sheets URL 미설정');
      return false;
    }

    try {
      // 캐시 방지용 타임스탬프 추가
      const fetchUrl = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
      const response = await fetch(fetchUrl);
      if (!response.ok) throw new Error('HTTP ' + response.status);

      const csv = await response.text();
      const rows = csv.split('\n');

      // 첫 줄 = 헤더, 나머지 = 데이터
      if (rows.length < 2) return 0;

      const batch = App.db.batch();
      let updated = 0;
      let errors = 0;
      const priceMap = {};  // 캐시용 가격 맵

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i].trim();
        if (!row) continue;

        // TSV 또는 CSV 파싱
        const cols = row.includes('\t') ? row.split('\t') : row.split(',');
        const code = (cols[0] || '').trim().replace(/"/g, '').padStart(6, '0');
        const priceRaw = (cols[2] || '').trim().replace(/"/g, '');
        const prevCloseRaw = (cols[3] || '').trim().replace(/"/g, '');

        // 유효성 검사 (#N/A, 빈값, 에러 건너뛰기)
        if (!code || !priceRaw || priceRaw.includes('#') || priceRaw.includes('N/A')) {
          errors++;
          continue;
        }

        const price = Math.round(parseFloat(priceRaw));
        const prevClose = Math.round(parseFloat(prevCloseRaw)) || price;
        if (isNaN(price) || price <= 0) continue;

        const change = price - prevClose;
        const changePct = prevClose > 0
          ? Math.round((change / prevClose) * 10000) / 100
          : 0;

        const ref = App.db.collection(CONFIG.COLLECTIONS.STOCKS).doc(code);
        batch.set(ref, {
          price: price,
          prevClose: prevClose,
          change: change,
          changePct: changePct,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // 캐시용 수집
        priceMap[code] = { price, prevClose, change, changePct, volume: 0 };

        updated++;
      }

      if (updated > 0) {
        // 가격 캐시 문서도 함께 업데이트 (읽기 최적화)
        const cacheRef = App.db.collection(CONFIG.COLLECTIONS.CONFIG).doc('priceCache');
        batch.set(cacheRef, {
          prices: priceMap,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();
        this.lastUpdate = new Date();
        // 차트 캐시 초기화 (새 가격 반영)
        if (typeof Chart !== 'undefined') Chart.cache = {};
      }

      console.log('시세 업데이트: ' + updated + '개 성공, ' + errors + '개 스킵');
      return updated;

    } catch (e) {
      console.error('시세 가져오기 실패:', e);
      return false;
    }
  },

  /* 자동 가져오기 시작 (분 단위) */
  startAutoFetch(intervalMin) {
    const min = intervalMin || 5;
    this.stopAutoFetch();

    // 수면 시간이면 첫 실행 스킵
    const schedule = Utils.getRefreshSchedule();
    if (schedule.mode !== 'sleep') {
      this.fetchPrices().then(result => {
        if (result !== false && result > 0) {
          Utils.toast('실시간 시세 연동 중 📡', 'success');
        }
      });
    }

    // 주기적 실행 (수면 시간 제외)
    this._timer = setInterval(() => {
      const s = Utils.getRefreshSchedule();
      if (s.mode !== 'sleep') {
        this.fetchPrices();
      }
    }, min * 60 * 1000);
  },

  /* 자동 가져오기 중지 */
  stopAutoFetch() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  },

  /* 연동 상태 확인 */
  isConfigured() {
    const url = CONFIG.SHEET_CSV_URL;
    return url && !url.includes('YOUR_') && url.length > 10;
  }
};
