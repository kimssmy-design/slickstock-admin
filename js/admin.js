/* ============================================================
 *  admin.js — 관리자 패널 (PIN, 회원관리, 종목관리, 시장제어)
 * ============================================================ */

const Admin = {
  pinCode: '',

  /* ── PIN 모달 ── */
  openPin(callback) {
    this.pinCode = '';
    this._pinCallback = callback;
    this.updatePinDots();
    document.getElementById('pinOverlay').classList.add('show');
  },

  closePin() {
    document.getElementById('pinOverlay').classList.remove('show');
    this.pinCode = '';
  },

  pinInput(n) {
    if (this.pinCode.length >= 6) return;
    this.pinCode += n;
    this.updatePinDots();

    if (this.pinCode.length === 6) {
      setTimeout(() => {
        if (this.pinCode === App.config.adminPin) {
          App.adminUnlocked = true;
          this.closePin();
          if (this._pinCallback) this._pinCallback();
        } else {
          // 에러 애니메이션
          document.querySelectorAll('.pin-dot').forEach(d => {
            d.classList.remove('filled');
            d.classList.add('error');
          });
          Utils.toast('비밀번호가 틀렸어요', 'error');
          setTimeout(() => { this.pinCode = ''; this.updatePinDots(); }, 500);
        }
      }, 150);
    }
  },

  pinDelete() {
    this.pinCode = this.pinCode.slice(0, -1);
    this.updatePinDots();
  },

  updatePinDots() {
    document.querySelectorAll('.pin-dot').forEach((d, i) => {
      d.classList.remove('filled', 'error');
      if (i < this.pinCode.length) d.classList.add('filled');
    });
  },

  /* ── 관리자 탭 렌더링 ── */
  async render() {
    const el = document.getElementById('adminContent');
    if (!el) return;

    // 설정 로드
    await this.loadConfig();

    const marketStatus = Utils.isMarketHours();
    const override = App.config.marketOverride;
    let marketLabel = marketStatus ? '🟢 장 운영중' : '🔴 장 마감';
    if (override === true) marketLabel = '🟡 강제 개장';
    if (override === false) marketLabel = '🟡 강제 폐장';

    el.innerHTML = `
      <!-- 시장 제어 -->
      <div class="admin-card">
        <div class="admin-card-title">⚡ 시장 제어</div>
        <div style="text-align:center;margin-bottom:10px;font-size:15px;font-weight:700;">${marketLabel}</div>
        <div style="display:flex;gap:8px;">
          <button class="admin-btn" style="flex:1;background:var(--green);" onclick="Admin.setMarket(true)">장 열기</button>
          <button class="admin-btn red" style="flex:1;" onclick="Admin.setMarket(false)">장 닫기</button>
          <button class="admin-btn" style="flex:1;background:var(--text2);" onclick="Admin.setMarket(null)">자동</button>
        </div>
        <div style="margin-top:8px;">
          <button class="admin-btn blue" style="width:100%;" onclick="Admin.updatePrices()">
            ${PriceFetch.isConfigured() ? '📡 실시간 시세 가져오기' : '📡 주가 업데이트 (시뮬레이션)'}
          </button>
        </div>
        ${PriceFetch.isConfigured()
          ? '<div style="font-size:12px;color:var(--green);margin-top:6px;">✅ 실시간 시세 연동 활성화 (5분 자동)</div>'
          : '<div style="font-size:12px;color:var(--text2);margin-top:6px;">⚠️ config.js에 Google Sheets URL을 설정하면 실시간 연동됩니다</div>'
        }
        ${PriceFetch.lastUpdate
          ? '<div style="font-size:11px;color:var(--text3);margin-top:2px;">마지막 업데이트: ' + PriceFetch.lastUpdate.toLocaleTimeString('ko-KR') + '</div>'
          : ''
        }
      </div>

      <!-- 초기 데이터 로드 -->
      <div class="admin-card">
        <div class="admin-card-title">📦 초기 데이터</div>
        <div style="display:flex;gap:8px;">
          <button class="admin-btn" style="flex:1;" onclick="Admin.loadInitialStocks()">종목 데이터 로드 (${STOCK_DATA.length}개)</button>
        </div>
        <div style="font-size:12px;color:var(--text2);margin-top:6px;">처음 세팅할 때만 사용. 기존 종목은 덮어쓰지 않아요.</div>
      </div>

      <!-- 회원 관리 -->
      <div class="admin-card">
        <div class="admin-card-title" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;" onclick="Admin.toggleUsers()">
          <span>👥 회원 관리</span>
          <span id="userToggleIcon" style="font-size:12px;color:var(--text2);">▶ 펼치기</span>
        </div>
        <div id="adminUsers" style="display:none;"></div>
      </div>

      <!-- 공지 관리 -->
      <div class="admin-card">
        <div class="admin-card-title" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;" onclick="Admin.toggleNotices()">
          <span>📢 공지 관리</span>
          <span id="noticeToggleIcon" style="font-size:12px;color:var(--text2);">▶ 펼치기</span>
        </div>
        <div id="noticeCount" style="font-size:12px;color:var(--text2);"></div>
        <div id="adminNotices" style="display:none;"></div>
      </div>

      <!-- 종목 관리 -->
      <div class="admin-card">
        <div class="admin-card-title">📊 종목 관리 (${App.stocks.length}개)</div>
        <div style="display:flex;gap:8px;margin-bottom:10px;">
          <button class="admin-btn" style="flex:1;" onclick="Admin.showAddStock()">종목 추가</button>
          <button class="admin-btn red" style="flex:1;" onclick="Admin.showRemoveStock()">종목 삭제</button>
        </div>
        <button class="admin-btn red" style="width:100%;margin-bottom:8px;background:#222;" onclick="Admin.deleteAllStocks()">🗑️ 종목 전체 삭제</button>
        <div id="adminStockForm"></div>
      </div>

      <!-- 초기 자본 설정 -->
      <div class="admin-card">
        <div class="admin-card-title">💰 초기 자본 설정</div>
        <div style="font-size:13px;color:var(--text2);margin-bottom:6px;">신규 가입 시 지급되는 금액</div>
        <div style="display:flex;gap:8px;">
          <input type="number" id="initialCapitalInput" value="${App.config.initialCapital}"
            style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);font-size:16px;font-weight:700;font-family:inherit;">
          <button class="admin-btn orange" onclick="Admin.saveInitialCapital()">저장</button>
        </div>
      </div>

      <!-- 관리자 PIN 변경 -->
      <div class="admin-card">
        <div class="admin-card-title">🔒 관리자 PIN 변경</div>
        <div style="display:flex;gap:8px;">
          <input type="password" id="newPinInput" maxlength="6" inputmode="numeric" placeholder="새 PIN 6자리"
            style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);font-size:16px;font-family:inherit;">
          <button class="admin-btn orange" onclick="Admin.savePin()">변경</button>
        </div>
      </div>
    `;

    // 공지 카운트 로드
    this.loadNoticeCount();

    // 회원 목록은 접기 상태 — 토글 시 로드
    this._usersOpen = false;
  },

  /* 설정 로드 */
  async loadConfig() {
    try {
      const doc = await App.db.collection(CONFIG.COLLECTIONS.CONFIG).doc('settings').get();
      if (doc.exists) {
        const d = doc.data();
        App.config.adminPin = d.adminPin || CONFIG.DEFAULT_ADMIN_PIN;
        App.config.initialCapital = d.initialCapital || CONFIG.DEFAULT_CAPITAL;
        App.config.marketOverride = d.marketOverride != null ? d.marketOverride : null;
      }
    } catch (e) {
      console.error('설정 로드 오류:', e);
    }
  },

  /* ── 공지 관리 ── */
  _noticesOpen: false,
  toggleNotices() {
    this._noticesOpen = !this._noticesOpen;
    const el = document.getElementById('adminNotices');
    const icon = document.getElementById('noticeToggleIcon');
    if (this._noticesOpen) {
      el.style.display = 'block';
      icon.textContent = '▼ 접기';
      this.loadNotices();
    } else {
      el.style.display = 'none';
      icon.textContent = '▶ 펼치기';
    }
  },

  async loadNoticeCount() {
    try {
      const doc = await App.db.collection(CONFIG.COLLECTIONS.CONFIG).doc('notices').get();
      const items = doc.exists ? (doc.data().items || []) : [];
      const now = Date.now();
      const active = items.filter(n => n.expiresAt > now);
      const el = document.getElementById('noticeCount');
      if (el) el.textContent = active.length > 0 ? '현재 활성 공지 ' + active.length + '개' : '활성 공지 없음';
    } catch (e) { /* 무시 */ }
  },

  async loadNotices() {
    const el = document.getElementById('adminNotices');
    if (!el) return;

    try {
      const doc = await App.db.collection(CONFIG.COLLECTIONS.CONFIG).doc('notices').get();
      const items = doc.exists ? (doc.data().items || []) : [];
      const now = Date.now();

      el.innerHTML = `
        <div style="background:var(--bg);border-radius:12px;padding:14px;margin-top:8px;margin-bottom:10px;">
          <div style="font-size:13px;font-weight:700;margin-bottom:8px;">📝 새 공지 작성</div>
          <input id="noticeHeadline" placeholder="헤드라인 (예: 이번주 미션!)"
            style="width:100%;padding:8px 12px;border-radius:8px;border:1px solid var(--border);background:#fff;font-size:13px;font-family:inherit;margin-bottom:6px;">
          <textarea id="noticeContent" placeholder="내용을 입력하세요" rows="3"
            style="width:100%;padding:8px 12px;border-radius:8px;border:1px solid var(--border);background:#fff;font-size:13px;font-family:inherit;resize:none;margin-bottom:6px;"></textarea>
          <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;">
            <span style="font-size:12px;color:var(--text2);white-space:nowrap;">공지 기간:</span>
            <select id="noticeDuration" style="flex:1;padding:6px 10px;border-radius:8px;border:1px solid var(--border);background:#fff;font-size:13px;font-family:inherit;">
              <option value="1">1일</option>
              <option value="2">2일</option>
              <option value="3">3일</option>
              <option value="7" selected>1주일</option>
              <option value="14">2주일</option>
              <option value="30">1개월</option>
            </select>
          </div>
          <button class="admin-btn" style="width:100%;background:var(--green);" onclick="Admin.createNotice()">📢 공지 올리기</button>
        </div>

        ${items.length > 0 ? '<div style="font-size:13px;font-weight:700;margin-bottom:6px;">현재 등록된 공지</div>' : ''}
        ${items.sort((a, b) => b.createdAt - a.createdAt).map(n => {
          const isActive = n.expiresAt > now;
          const expDate = new Date(n.expiresAt);
          const expStr = (expDate.getMonth()+1) + '/' + expDate.getDate() + ' ' + expDate.getHours() + ':00';
          return `<div style="padding:10px 12px;background:${isActive ? 'var(--card)' : 'var(--bg)'};border-radius:10px;margin-bottom:6px;${isActive ? 'box-shadow:var(--shadow);' : 'opacity:0.5;'}border-left:3px solid ${isActive ? 'var(--green)' : 'var(--text3)'};">
            <div style="display:flex;justify-content:space-between;align-items:start;">
              <div style="flex:1;">
                <div style="font-size:14px;font-weight:700;">${Utils.esc(n.headline)}</div>
                <div style="font-size:12px;color:var(--text2);margin-top:2px;line-height:1.5;">${Utils.esc(n.content)}</div>
                <div style="font-size:11px;color:var(--text3);margin-top:4px;">${isActive ? '✅ 활성' : '⏰ 만료'} · ~${expStr}</div>
              </div>
              <button class="admin-btn red" style="padding:4px 8px;font-size:10px;margin-left:8px;" onclick="Admin.deleteNotice('${n.id}')">삭제</button>
            </div>
          </div>`;
        }).join('')}
      `;
    } catch (e) {
      el.innerHTML = '<div style="color:var(--text2);padding:10px;font-size:12px;">로드 실패</div>';
    }
  },

  async createNotice() {
    const headline = document.getElementById('noticeHeadline').value.trim();
    const content = document.getElementById('noticeContent').value.trim();
    const days = Number(document.getElementById('noticeDuration').value);

    if (!headline) { Utils.toast('헤드라인을 입력해주세요', 'error'); return; }
    if (!content) { Utils.toast('내용을 입력해주세요', 'error'); return; }

    Utils.showLoading(true);
    try {
      const now = Date.now();
      const newNotice = {
        id: 'notice_' + now,
        headline, content,
        createdAt: now,
        expiresAt: now + days * 24 * 60 * 60 * 1000
      };

      const ref = App.db.collection(CONFIG.COLLECTIONS.CONFIG).doc('notices');
      const doc = await ref.get();
      const items = doc.exists ? (doc.data().items || []) : [];
      items.push(newNotice);
      await ref.set({ items });

      Utils.toast('공지 등록 완료! 📢', 'success');
      this.loadNotices();
      this.loadNoticeCount();
    } catch (e) {
      Utils.toast('공지 등록 실패', 'error');
    } finally {
      Utils.showLoading(false);
    }
  },

  async deleteNotice(noticeId) {
    if (!confirm('이 공지를 삭제할까요?')) return;
    Utils.showLoading(true);
    try {
      const ref = App.db.collection(CONFIG.COLLECTIONS.CONFIG).doc('notices');
      const doc = await ref.get();
      let items = doc.exists ? (doc.data().items || []) : [];
      items = items.filter(n => n.id !== noticeId);
      await ref.set({ items });
      Utils.toast('공지 삭제 완료', 'success');
      this.loadNotices();
      this.loadNoticeCount();
    } catch (e) {
      Utils.toast('삭제 실패', 'error');
    } finally {
      Utils.showLoading(false);
    }
  },

  /* 회원 목록 토글 */
  _usersOpen: false,
  toggleUsers() {
    this._usersOpen = !this._usersOpen;
    const el = document.getElementById('adminUsers');
    const icon = document.getElementById('userToggleIcon');
    if (this._usersOpen) {
      el.style.display = 'block';
      icon.textContent = '▼ 접기';
      this.loadUsers();
    } else {
      el.style.display = 'none';
      icon.textContent = '▶ 펼치기';
    }
  },

  /* 회원 목록 로드 */
  async loadUsers() {
    const el = document.getElementById('adminUsers');
    if (!el) return;
    el.innerHTML = '<div style="text-align:center;padding:10px;color:var(--text2);">로딩 중...</div>';

    try {
      const snap = await App.db.collection(CONFIG.COLLECTIONS.USERS).get();
      const users = [];
      snap.forEach(doc => {
        users.push({ id: doc.id, ...doc.data() });
      });

      // 미거래 회원 판별 (가입 2주 이상 + 보유종목 없음 + 잔고 미변동)
      const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;
      let inactiveCount = 0;

      el.innerHTML = `
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:10px;flex-wrap:wrap;">
          <input id="userSearchInput" type="text" placeholder="회원 검색" oninput="Admin.filterUsers(this.value)"
            style="flex:1;min-width:120px;padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);font-size:13px;font-family:inherit;outline:none;">
          <button class="admin-btn orange" style="white-space:nowrap;padding:8px 10px;font-size:12px;" onclick="Admin.giveCapitalAll()">전체추가금</button>
        </div>
        <div style="font-size:13px;color:var(--text2);padding:0 0 8px;">${users.length}명 등록됨</div>
        ${users.map(u => {
          // NEW 배지: 24시간 이내 가입
          const isNew = u.createdAt && (Date.now() - (u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt)).getTime()) < 24 * 60 * 60 * 1000;

          // 미거래 판별: 2주 이상 + 보유종목 없음 + 잔고 = 초기자본
          const accountAge = u.createdAt ? Date.now() - (u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt)).getTime() : 0;
          const holdingsEmpty = !u.holdings || Object.keys(u.holdings).length === 0;
          const balanceUntouched = u.balance === (u.initialCapital || App.config.initialCapital);
          const isInactive = accountAge > TWO_WEEKS && holdingsEmpty && balanceUntouched;
          if (isInactive) inactiveCount++;

          return `
          <div class="admin-user-row" style="flex-wrap:wrap;${isInactive ? 'opacity:0.5;background:var(--bg);' : ''}">
            <div style="cursor:pointer;flex:1;min-width:0;" onclick="Admin.showUserDetail('${Utils.esc(u.id)}')">
              <div class="admin-user-name">${Utils.esc(u.name || u.id)} ${isNew ? '<span style="background:#FF3B30;color:#fff;font-size:10px;padding:1px 5px;border-radius:4px;margin-left:4px;font-weight:700;">NEW</span>' : ''} ${isInactive ? '<span style="background:#8E8E93;color:#fff;font-size:10px;padding:1px 5px;border-radius:4px;margin-left:4px;font-weight:700;">💤 미거래</span>' : ''}</div>
              <div class="admin-user-bal">잔고 ${Utils.formatWon(u.balance)} <span style="font-size:11px;color:var(--text3);">▼ 터치해서 상세보기</span></div>
            </div>
            <div style="display:flex;gap:4px;">
              <button class="admin-btn" style="background:var(--down);padding:4px 8px;font-size:11px;" onclick="event.stopPropagation();Admin.resetPassword('${Utils.esc(u.id)}')">비번</button>
              <button class="admin-btn orange" style="padding:4px 8px;font-size:11px;" onclick="event.stopPropagation();Admin.giveCapital('${Utils.esc(u.id)}')">추가금</button>
              <button class="admin-btn red" style="padding:4px 8px;font-size:11px;" onclick="event.stopPropagation();Admin.resetUser('${Utils.esc(u.id)}')">초기화</button>
              <button class="admin-btn" style="background:#333;padding:4px 6px;font-size:10px;" onclick="event.stopPropagation();Admin.kickUser('${Utils.esc(u.id)}')">out</button>
            </div>
            <div id="userDetail_${u.id.replace(/[^a-zA-Z0-9가-힣]/g,'_')}" style="display:none;width:100%;"></div>
          </div>`;
        }).join('')}
        ${inactiveCount > 0 ? '<div style="text-align:center;padding:10px;font-size:12px;color:var(--up);font-weight:700;">⚠️ 2주 이상 미거래 회원 ' + inactiveCount + '명</div>' : ''}
      `;
    } catch (e) {
      el.innerHTML = '<div style="color:var(--text2);padding:10px;">로드 실패</div>';
    }
  },

  /* 전체 추가금 지급 */
  async giveCapitalAll() {
    const amount = prompt('전체 회원에게 추가금 지급 (원):', '1000000');
    if (!amount || isNaN(Number(amount))) return;
    if (!confirm('모든 회원에게 ' + Utils.formatWon(Number(amount)) + '을 지급할까요?')) return;

    Utils.showLoading(true);
    try {
      const snap = await App.db.collection(CONFIG.COLLECTIONS.USERS).get();
      const batch = App.db.batch();
      snap.forEach(doc => {
        batch.update(doc.ref, {
          balance: firebase.firestore.FieldValue.increment(Number(amount))
        });
      });
      await batch.commit();
      Utils.toast(snap.size + '명에게 ' + Utils.formatWon(Number(amount)) + ' 지급 완료!', 'success');
      this.loadUsers();
    } catch (e) {
      Utils.toast('전체 지급 실패: ' + e.message, 'error');
    } finally {
      Utils.showLoading(false);
    }
  },

  /* 회원 이름 검색 필터 */
  filterUsers(query) {
    const rows = document.querySelectorAll('#adminUsers .admin-user-row');
    const q = query.toLowerCase().trim();
    rows.forEach(row => {
      const name = row.querySelector('.admin-user-name');
      if (name) {
        row.style.display = !q || name.textContent.toLowerCase().includes(q) ? '' : 'none';
      }
    });
  },

  /* 추가금 지급 */
  async giveCapital(userId) {
    const amount = prompt(`${userId}에게 추가금 지급 (원):`, '1000000');
    if (!amount || isNaN(Number(amount))) return;

    Utils.showLoading(true);
    try {
      await App.db.collection(CONFIG.COLLECTIONS.USERS).doc(userId).update({
        balance: firebase.firestore.FieldValue.increment(Number(amount))
      });
      Utils.toast(`${userId}에게 ${Utils.formatWon(Number(amount))} 지급 완료`, 'success');
      this.loadUsers();
      if (App.user && App.user.id === userId) await Auth.refreshUser();
    } catch (e) {
      Utils.toast('지급 실패: ' + e.message, 'error');
    } finally {
      Utils.showLoading(false);
    }
  },

  /* 사용자 초기화 */
  async resetUser(userId) {
    if (!confirm(`${userId}의 잔고와 보유종목을 모두 초기화할까요?`)) return;

    Utils.showLoading(true);
    try {
      await App.db.collection(CONFIG.COLLECTIONS.USERS).doc(userId).update({
        balance: App.config.initialCapital,
        holdings: {}
      });
      Utils.toast(`${userId} 초기화 완료`, 'success');
      this.loadUsers();
      if (App.user && App.user.id === userId) await Auth.refreshUser();
    } catch (e) {
      Utils.toast('초기화 실패', 'error');
    } finally {
      Utils.showLoading(false);
    }
  },

  /* 학생 계좌 상세보기 */
  async showUserDetail(userId) {
    const safeId = userId.replace(/[^a-zA-Z0-9가-힣]/g, '_');
    const el = document.getElementById('userDetail_' + safeId);
    if (!el) return;

    // 토글
    if (el.style.display === 'block') {
      el.style.display = 'none';
      return;
    }

    el.style.display = 'block';
    el.innerHTML = '<div style="padding:8px;color:var(--text2);font-size:12px;">로딩 중...</div>';

    try {
      const doc = await App.db.collection(CONFIG.COLLECTIONS.USERS).doc(userId).get();
      if (!doc.exists) { el.innerHTML = '<div style="padding:8px;color:var(--text2);">데이터 없음</div>'; return; }

      const u = doc.data();
      const holdings = u.holdings || {};
      let investTotal = 0;
      let totalCost = 0;
      const holdingsList = [];

      for (const [code, h] of Object.entries(holdings)) {
        const stock = App.stocks.find(s => s.code === code);
        if (!stock || h.qty <= 0) continue;
        const val = h.qty * stock.price;
        const cost = h.qty * h.avgPrice;
        investTotal += val;
        totalCost += cost;
        holdingsList.push({ name: stock.name, qty: h.qty, pnl: val - cost, pnlPct: cost > 0 ? ((val - cost) / cost * 100) : 0 });
      }

      const totalAsset = (u.balance || 0) + investTotal;
      // 보유 종목 수익률 (시드머니/추가금 무관)
      const holdingsPnl = investTotal - totalCost;
      const holdingsPnlPct = totalCost > 0 ? (holdingsPnl / totalCost * 100) : 0;

      holdingsList.sort((a, b) => b.pnlPct - a.pnlPct);

      el.innerHTML = `
        <div style="background:var(--bg);border-radius:10px;padding:12px;margin-top:8px;font-size:12px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <span style="color:var(--text2);">총 자산</span>
            <b>${Utils.formatWon(totalAsset)}</b>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <span style="color:var(--text2);">보유 현금</span>
            <span>${Utils.formatWon(u.balance)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <span style="color:var(--text2);">투자 평가액</span>
            <span>${Utils.formatWon(investTotal)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="color:var(--text2);">보유종목 수익률</span>
            <b class="${Utils.dir(holdingsPnl)}">${totalCost > 0 ? Utils.formatPct(holdingsPnlPct) : '미투자'}</b>
          </div>
          ${holdingsList.length > 0 ? '<div style="border-top:1px solid var(--border);padding-top:6px;font-size:11px;color:var(--text2);">보유 종목</div>' : ''}
          ${holdingsList.map(h => `
            <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;">
              <span>${Utils.esc(h.name)} ${h.qty}주</span>
              <span class="${Utils.dir(h.pnl)}">${Utils.formatPct(h.pnlPct)}</span>
            </div>`).join('')}
          ${holdingsList.length === 0 ? '<div style="color:var(--text3);font-size:11px;padding-top:4px;">보유 종목 없음</div>' : ''}
        </div>`;
    } catch (e) {
      el.innerHTML = '<div style="padding:8px;color:var(--up);font-size:12px;">조회 실패</div>';
    }
  },

  /* 회원 탈퇴 (삭제) */
  async kickUser(userId) {
    if (!confirm(`⚠️ "${userId}" 회원을 탈퇴시킬까요?\n모든 데이터(잔고, 보유종목, 거래내역)가 삭제됩니다.`)) return;

    Utils.showLoading(true);
    try {
      await App.db.collection(CONFIG.COLLECTIONS.USERS).doc(userId).delete();
      Utils.toast(`${userId} 탈퇴 완료`, 'success');
      this.loadUsers();
    } catch (e) {
      Utils.toast('탈퇴 실패: ' + e.message, 'error');
    } finally {
      Utils.showLoading(false);
    }
  },

  /* 비밀번호 재설정 */
  async resetPassword(userId) {
    const newPw = prompt(`${userId}의 새 비밀번호 (숫자 6자리):`, '');
    if (!newPw) return;
    if (!/^\d{6}$/.test(newPw)) {
      Utils.toast('숫자 6자리로 입력해주세요', 'error');
      return;
    }

    Utils.showLoading(true);
    try {
      const hash = await Utils.sha256(newPw);
      await App.db.collection(CONFIG.COLLECTIONS.USERS).doc(userId).update({
        passwordHash: hash
      });
      Utils.toast(`${userId} 비밀번호 변경 완료`, 'success');
    } catch (e) {
      Utils.toast('비밀번호 변경 실패', 'error');
    } finally {
      Utils.showLoading(false);
    }
  },

  /* 시장 제어 */
  async setMarket(override) {
    try {
      await App.db.collection(CONFIG.COLLECTIONS.CONFIG).doc('settings').set(
        { marketOverride: override },
        { merge: true }
      );
      App.config.marketOverride = override;
      if (typeof AppUI !== 'undefined') AppUI.updateMarketStatus();
      this.render();
      Utils.toast(
        override === true ? '장이 열렸어요!' :
        override === false ? '장이 닫혔어요' :
        '자동 모드로 전환', 'success'
      );
    } catch (e) {
      Utils.toast('시장 제어 실패', 'error');
    }
  },

  /* 초기 자본 저장 */
  async saveInitialCapital() {
    const val = Number(document.getElementById('initialCapitalInput').value);
    if (!val || val < 100000) { Utils.toast('최소 10만원 이상 설정해주세요', 'error'); return; }

    try {
      await App.db.collection(CONFIG.COLLECTIONS.CONFIG).doc('settings').set(
        { initialCapital: val },
        { merge: true }
      );
      App.config.initialCapital = val;
      Utils.toast('초기 자본 저장 완료', 'success');
    } catch (e) {
      Utils.toast('저장 실패', 'error');
    }
  },

  /* PIN 변경 */
  async savePin() {
    const pin = document.getElementById('newPinInput').value;
    if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      Utils.toast('6자리 숫자로 입력해주세요', 'error'); return;
    }
    try {
      await App.db.collection(CONFIG.COLLECTIONS.CONFIG).doc('settings').set(
        { adminPin: pin },
        { merge: true }
      );
      App.config.adminPin = pin;
      Utils.toast('PIN 변경 완료', 'success');
    } catch (e) {
      Utils.toast('PIN 변경 실패', 'error');
    }
  },

  /* ── 종목 추가 폼 ── */
  showAddStock() {
    document.getElementById('adminStockForm').innerHTML = `
      <div style="background:var(--bg);border-radius:12px;padding:14px;margin-top:8px;">
        <div style="font-size:13px;font-weight:700;margin-bottom:8px;">종목 추가</div>
        <input id="addStockCode" placeholder="종목코드 (예: 005930)" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);margin-bottom:6px;font-family:inherit;background:#fff;">
        <input id="addStockName" placeholder="종목명 (예: 삼성전자)" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);margin-bottom:6px;font-family:inherit;background:#fff;">
        <input id="addStockPrice" type="number" placeholder="현재가 (예: 69900)" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);margin-bottom:6px;font-family:inherit;background:#fff;">
        <input id="addStockEmoji" placeholder="이모지 (예: 📱)" maxlength="4" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);margin-bottom:6px;font-family:inherit;background:#fff;">
        <textarea id="addStockDesc" placeholder="한줄 설명" rows="2" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);margin-bottom:8px;font-family:inherit;resize:none;background:#fff;"></textarea>
        <button class="admin-btn" style="width:100%;" onclick="Admin.addStock()">추가하기</button>
      </div>`;
  },

  async addStock() {
    const code = document.getElementById('addStockCode').value.trim();
    const name = document.getElementById('addStockName').value.trim();
    const price = Number(document.getElementById('addStockPrice').value);
    const emoji = document.getElementById('addStockEmoji').value.trim() || '🏢';
    const oneliner = document.getElementById('addStockDesc').value.trim() || '';

    if (!code || !name || !price) { Utils.toast('필수 항목을 입력해주세요', 'error'); return; }

    Utils.showLoading(true);
    try {
      await App.db.collection(CONFIG.COLLECTIONS.STOCKS).doc(code).set({
        code, name, price, emoji, oneliner,
        desc: oneliner,
        prevClose: price,
        change: 0, changePct: 0,
        volume: 0,
        keywords: [],
        sector: '',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      Utils.toast(`${name} 추가 완료`, 'success');
      document.getElementById('adminStockForm').innerHTML = '';
    } catch (e) {
      Utils.toast('종목 추가 실패', 'error');
    } finally {
      Utils.showLoading(false);
    }
  },

  /* 종목 삭제 */
  showRemoveStock() {
    const list = App.stocks.map(s =>
      `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">
        <span style="font-size:13px;">${Utils.esc(s.name)} (${s.code})</span>
        <button class="admin-btn red" style="padding:4px 10px;font-size:12px;" onclick="Admin.removeStock('${s.code}','${Utils.esc(s.name)}')">삭제</button>
      </div>`
    ).join('');

    document.getElementById('adminStockForm').innerHTML = `
      <div style="background:var(--bg);border-radius:12px;padding:14px;margin-top:8px;max-height:300px;overflow-y:auto;">
        <div style="font-size:13px;font-weight:700;margin-bottom:8px;">종목 삭제</div>
        ${list}
      </div>`;
  },

  async removeStock(code, name) {
    if (!confirm(`${name}(${code})을 삭제할까요?`)) return;
    try {
      await App.db.collection(CONFIG.COLLECTIONS.STOCKS).doc(code).delete();
      Utils.toast(`${name} 삭제 완료`, 'success');
      this.showRemoveStock();
    } catch (e) {
      Utils.toast('삭제 실패', 'error');
    }
  },

  /* 종목 전체 삭제 */
  async deleteAllStocks() {
    if (!confirm('⚠️ 모든 종목 데이터를 삭제할까요?\n삭제 후 "종목 데이터 로드"로 다시 채울 수 있어요.')) return;

    Utils.showLoading(true);
    try {
      const snap = await App.db.collection(CONFIG.COLLECTIONS.STOCKS).get();
      const batch = App.db.batch();
      snap.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      App.stocks = [];
      Utils.toast(snap.size + '개 종목 전체 삭제 완료', 'success');
      this.render();
    } catch (e) {
      Utils.toast('전체 삭제 실패: ' + e.message, 'error');
    } finally {
      Utils.showLoading(false);
    }
  },

  /* ── 초기 종목 데이터 Firestore 로드 ── */
  async loadInitialStocks() {
    if (!confirm(`${STOCK_DATA.length}개 종목을 Firestore에 로드할까요?\n(기존 동일 코드 종목은 건너뜁니다)`)) return;

    Utils.showLoading(true);
    let added = 0, skipped = 0;

    try {
      const batch = App.db.batch();
      const existing = new Set();

      // 기존 종목 코드 수집
      const snap = await App.db.collection(CONFIG.COLLECTIONS.STOCKS).get();
      snap.forEach(doc => existing.add(doc.id));

      for (const s of STOCK_DATA) {
        if (existing.has(s.code)) { skipped++; continue; }

        const ref = App.db.collection(CONFIG.COLLECTIONS.STOCKS).doc(s.code);
        batch.set(ref, {
          code: s.code,
          name: s.name,
          price: s.price,
          prevClose: s.price,
          change: 0,
          changePct: 0,
          volume: 0,
          emoji: s.emoji || '🏢',
          oneliner: s.oneliner || '',
          desc: s.desc || '',
          keywords: s.keywords || [],
          sector: s.sector || '',
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        added++;
      }

      if (added > 0) await batch.commit();

      // 설정도 초기화
      const cfgRef = App.db.collection(CONFIG.COLLECTIONS.CONFIG).doc('settings');
      const cfgDoc = await cfgRef.get();
      if (!cfgDoc.exists) {
        await cfgRef.set({
          adminPin: CONFIG.DEFAULT_ADMIN_PIN,
          initialCapital: CONFIG.DEFAULT_CAPITAL,
          marketOverride: null
        });
      }

      Utils.toast(`${added}개 추가, ${skipped}개 건너뜀`, 'success');
    } catch (e) {
      console.error('초기 데이터 로드 오류:', e);
      Utils.toast('데이터 로드 실패: ' + e.message, 'error');
    } finally {
      Utils.showLoading(false);
    }
  },

  /* ── 실시간 주가 업데이트 ── */
  async updatePrices() {
    if (App.stocks.length === 0) {
      Utils.toast('종목이 없어요. 먼저 데이터를 로드해주세요.', 'error');
      return;
    }

    Utils.showLoading(true);

    // Google Sheets 연동이 설정된 경우 → 실시간 시세
    if (PriceFetch.isConfigured()) {
      try {
        const count = await PriceFetch.fetchPrices();
        if (count && count > 0) {
          Utils.toast(count + '개 종목 실시간 시세 반영! 📡', 'success');
          this.render();
        } else {
          Utils.toast('시세를 가져오지 못했어요. URL을 확인해주세요.', 'error');
        }
      } catch (e) {
        Utils.toast('시세 연동 실패: ' + e.message, 'error');
      } finally {
        Utils.showLoading(false);
      }
      return;
    }

    // 미설정 → 시뮬레이션 (랜덤 변동)
    try {
      // 시뮬레이션: 각 종목에 -5% ~ +5% 랜덤 변동 적용
      const batch = App.db.batch();
      const priceMap = {};

      for (const stock of App.stocks) {
        const volatility = (Math.random() - 0.48) * 0.06; // 살짝 상승 편향
        const newPrice = Math.round(stock.price * (1 + volatility));
        const prevClose = stock.price;
        const change = newPrice - prevClose;
        const changePct = prevClose > 0 ? (change / prevClose * 100) : 0;

        const ref = App.db.collection(CONFIG.COLLECTIONS.STOCKS).doc(stock.code);
        batch.update(ref, {
          price: newPrice,
          prevClose: prevClose,
          change: change,
          changePct: Math.round(changePct * 100) / 100,
          volume: Math.floor(Math.random() * 5000000) + 100000,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        priceMap[stock.code] = {
          price: newPrice, prevClose, change,
          changePct: Math.round(changePct * 100) / 100,
          volume: Math.floor(Math.random() * 5000000) + 100000
        };
      }

      // 캐시 문서도 업데이트
      const cacheRef = App.db.collection(CONFIG.COLLECTIONS.CONFIG).doc('priceCache');
      batch.set(cacheRef, { prices: priceMap, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });

      await batch.commit();
      Utils.toast('주가 업데이트 완료! 📡', 'success');

    } catch (e) {
      console.error('주가 업데이트 오류:', e);
      Utils.toast('업데이트 실패: ' + e.message, 'error');
    } finally {
      Utils.showLoading(false);
    }
  }
};
