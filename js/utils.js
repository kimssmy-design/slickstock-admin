/* ============================================================
 *  utils.js — 공통 유틸리티 함수
 * ============================================================ */

const Utils = {
  /* SHA-256 해시 (비밀번호 암호화용) */
  async sha256(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  },

  /* 숫자 → 원화 포맷 */
  formatWon(n) {
    if (n == null) return '₩0';
    return '₩' + Math.floor(n).toLocaleString('ko-KR');
  },

  /* 숫자만 포맷 (₩ 없이) */
  formatNum(n) {
    if (n == null) return '0';
    return Math.floor(n).toLocaleString('ko-KR');
  },

  /* 변동률 포맷 (+2.35%) */
  formatPct(pct) {
    if (pct == null) return '0.00%';
    const sign = pct > 0 ? '+' : '';
    return sign + pct.toFixed(2) + '%';
  },

  /* 방향 클래스 (up/down/flat) */
  dir(value) {
    if (value > 0) return 'up';
    if (value < 0) return 'down';
    return 'flat';
  },

  /* 방향 화살표 */
  arrow(value) {
    if (value > 0) return '▲';
    if (value < 0) return '▼';
    return '';
  },

  /* 현재 장 운영 여부 체크 (한국시간 기준) */
  isMarketHours() {
    // 관리자 오버라이드 확인
    if (App.config.marketOverride === true) return true;
    if (App.config.marketOverride === false) return false;

    const now = new Date();
    // UTC → KST (+9시간)
    const kst = new Date(now.getTime() + (9 * 60 + now.getTimezoneOffset()) * 60000);
    const day = kst.getDay(); // 0=일, 6=토
    if (day === 0 || day === 6) return false; // 주말

    const h = kst.getHours();
    const m = kst.getMinutes();
    const time = h * 60 + m;
    const open = CONFIG.MARKET_OPEN_HOUR * 60 + CONFIG.MARKET_OPEN_MIN;
    const close = CONFIG.MARKET_CLOSE_HOUR * 60 + CONFIG.MARKET_CLOSE_MIN;
    return time >= open && time <= close;
  },

  /* 토스트 메시지 표시 */
  toast(msg, type = 'info') {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast show ' + type;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 2500);
  },

  /* 로딩 표시/숨기기 */
  showLoading(show = true) {
    const el = document.getElementById('loading');
    if (el) el.style.display = show ? 'flex' : 'none';
  },

  /* HTML 이스케이프 */
  esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  },

  /* 디바운스 */
  debounce(fn, delay = 300) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
  },

  /* 시간대별 새로고침 스케줄 (KST 기준) */
  getRefreshSchedule() {
    // 관리자 강제 제어 우선
    if (App.config.marketOverride === true)
      return { interval: 5, mode: 'forced' };
    if (App.config.marketOverride === false)
      return { interval: 0, mode: 'sleep' };

    const now = new Date();
    const kst = new Date(now.getTime() + (9 * 60 + now.getTimezoneOffset()) * 60000);
    const h = kst.getHours();
    const m = kst.getMinutes();
    const time = h * 60 + m;

    // 22:00~08:00 → 수면 모드
    if (time >= 22 * 60 || time < 8 * 60)
      return { interval: 0, mode: 'sleep' };
    // 08:00~09:00 → 5분
    if (time < 9 * 60)
      return { interval: 5, mode: 'pre' };
    // 09:00~15:20 → 30분
    if (time < 15 * 60 + 20)
      return { interval: 30, mode: 'market' };
    // 15:20~16:40 → 5분
    if (time < 16 * 60 + 40)
      return { interval: 5, mode: 'closing' };
    // 16:40~22:00 → 시세 가져오기 정지 (마지막 가격 유지)
    return { interval: 0, mode: 'idle' };
  }
};
