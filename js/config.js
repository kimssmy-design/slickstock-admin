/* ============================================================
 *  config.js — Firebase 설정 & 앱 상수
 *  ⚠️ 아래 firebaseConfig를 본인 Firebase 프로젝트 값으로 교체하세요!
 * ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyAg5b0llifBXcZwdrg14SMXocxctnaGFhk",
  authDomain: "slickstock-2c512.firebaseapp.com",
  projectId: "slickstock-2c512",
  storageBucket: "slickstock-2c512.firebasestorage.app",
  messagingSenderId: "59971282695",
  appId: "1:59971282695:web:2169d269173705586c07a2"
};

/* ── 앱 전역 상수 ── */
const CONFIG = {
  MARKET_OPEN_HOUR:   8,    // 장 시작 08:00
  MARKET_OPEN_MIN:    0,
  MARKET_CLOSE_HOUR:  16,   // 장 마감 16:30
  MARKET_CLOSE_MIN:   30,
  DEFAULT_CAPITAL:    10000000,  // 기본 초기자본 1000만원
  DEFAULT_ADMIN_PIN:  '000000',  // 기본 관리자 PIN

  // ★ Google Sheets 실시간 시세 URL (아래 안내대로 설정)
  SHEET_CSV_URL: 'YOUR_GOOGLE_SHEETS_CSV_URL',

  COLLECTIONS: {
    USERS:        'sl_users',
    STOCKS:       'sl_stocks',
    TRANSACTIONS: 'sl_transactions',
    CONFIG:       'sl_config'
  }
};

/* ── 전역 앱 상태 ── */
window.App = {
  db: null,
  user: null,          // { id, name, balance, initialCapital, holdings }
  stocks: [],          // Firestore에서 로드한 종목 배열
  notices: [],         // 관리자 공지사항
  marketOpen: false,
  adminUnlocked: false,
  config: {            // Firestore sl_config/settings
    adminPin: CONFIG.DEFAULT_ADMIN_PIN,
    initialCapital: CONFIG.DEFAULT_CAPITAL,
    marketOverride: null  // null=자동, true=강제개장, false=강제폐장
  },
  unsubscribers: []    // Firestore 실시간 리스너 해제용
};
