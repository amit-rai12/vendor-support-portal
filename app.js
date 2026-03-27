/**
 * ═══════════════════════════════════════════════════════════════
 * Vendor Support Portal — Main Application Logic
 * ═══════════════════════════════════════════════════════════════
 */

(function () {
  'use strict';

  // ── DOM References ──
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  const resultsContainer = document.getElementById('results');
  const ticketListContainer = document.getElementById('ticketList');
  const ticketBadge = document.getElementById('ticketBadge');
  const submitBtn = document.getElementById('submitBtn');
  const ticketMsg = document.getElementById('ticketMsg');
  const headerStats = document.getElementById('headerStats');
  const tabNav = document.getElementById('tabNav');

  // Auth elements
  const authGate = document.getElementById('authGate');
  const authInput = document.getElementById('authInput');
  const authBtn = document.getElementById('authBtn');
  const authError = document.getElementById('authError');

  let _lastSearchData = null;

  // ══════════════════════════════════════
  //  INITIALISE
  // ══════════════════════════════════════
  async function init() {
    // Auth logic
    authBtn.addEventListener('click', handleAuth);
    authInput.addEventListener('keypress', e => { if (e.key === 'Enter') handleAuth(); });

    if (sessionStorage.getItem('vendor_auth') === 'true') {
      authGate.classList.add('hidden');
    }

    // Tab switching
    tabNav.querySelectorAll('.tab-nav__btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Search
    searchBtn.addEventListener('click', doSearch);
    searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') doSearch(); });

    // Submit ticket
    submitBtn.addEventListener('click', doSubmit);

    // Header stats
    updateHeaderStats();
  }

  // ══════════════════════════════════════
  //  AUTHENTICATION
  // ══════════════════════════════════════
  async function handleAuth() {
    const val = authInput.value.trim();
    if (!val) {
      showAuthError('Please enter a value');
      return;
    }

    authBtn.disabled = true;
    authBtn.textContent = 'Verifying...';
    authError.innerHTML = '';

    try {
      const config = await DataService.getConfig();
      const lowerVal = val.toLowerCase();
      
      // 1. Check Internal Email
      if (
        lowerVal.endsWith('@swiggy.in') || 
        lowerVal.endsWith('@scootsy.com') ||
        lowerVal.endsWith('@external.swiggy.in')
      ) {
        loginSuccess();
        return;
      }

      // 2. Check Access Password
      if (config.access_password && val === config.access_password) {
        loginSuccess();
        return;
      }

      // 3. Check Vendor Code or Name
      // Since it's a valid code/name, lookupVendor will find it
      const testLookup = await DataService.lookupVendor(val);
      if (!testLookup.error) {
        // Find it successfully, enter portal and auto-search
        loginSuccess(val);
        return;
      }

      showAuthError('Invalid Vendor Code, Password, or Email');
    } catch (e) {
      showAuthError('Error verifying access');
    } finally {
      authBtn.disabled = false;
      authBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
        Enter Portal
      `;
    }
  }

  function loginSuccess(autoSearchQuery = '') {
    sessionStorage.setItem('vendor_auth', 'true');
    authGate.classList.add('hidden');
    if (autoSearchQuery && !autoSearchQuery.includes('@')) {
       // Only pre-fill code/name, not password or email
       const configPass = DataService.getConfig().then(cfg => {
         if (autoSearchQuery !== cfg.access_password) {
           searchInput.value = autoSearchQuery;
           doSearch();
         }
       });
    }
  }

  function showAuthError(msg) {
    authError.innerHTML = `<div class="alert alert--error" style="margin-top:12px;text-align:left">${_esc(msg)}</div>`;
  }

  // ══════════════════════════════════════
  //  TAB SWITCHING
  // ══════════════════════════════════════
  function switchTab(tabId) {
    tabNav.querySelectorAll('.tab-nav__btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

    const btn = tabNav.querySelector(`[data-tab="${tabId}"]`);
    const panel = document.getElementById(tabId);
    if (btn) btn.classList.add('active');
    if (panel) panel.classList.add('active');
  }

  // ══════════════════════════════════════
  //  HEADER STATS
  // ══════════════════════════════════════
  function updateHeaderStats() {
    const localTickets = JSON.parse(localStorage.getItem('local_tickets') || '[]');
    const openCount = localTickets.filter(t =>
      ['OPEN', 'IN_PROGRESS', 'ESCALATED_L1', 'ESCALATED_L2'].includes(t.status.toUpperCase())
    ).length;

    const cacheTime = localStorage.getItem('vendor_cache_time');
    const lastSync = cacheTime ? _timeAgo(new Date(cacheTime)) : 'Never';

    headerStats.innerHTML = `
      <div class="header__stat">
        <span>📋</span>
        <span>Local Tickets: <strong class="header__stat-num">${localTickets.length}</strong></span>
      </div>
      <div class="header__stat">
        <span>🔄</span>
        <span>Last sync: <strong>${lastSync}</strong></span>
      </div>
    `;
  }

  function _timeAgo(date) {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
  }

  // ══════════════════════════════════════
  //  SEARCH
  // ══════════════════════════════════════
  async function doSearch() {
    const q = searchInput.value.trim();
    if (!q) {
      showToast('Please enter a vendor code or name', 'error');
      return;
    }

    resultsContainer.innerHTML = `
      <div class="loading">Searching for "${_esc(q)}"…<br><small style="color:var(--gray-400)">Fetching from Google Sheet</small></div>
    `;

    try {
      const data = await DataService.lookupVendor(q);
      _lastSearchData = data;
      renderResults(data);
    } catch (err) {
      resultsContainer.innerHTML = `<div class="alert alert--error">Error: ${_esc(err.message || err)}</div>`;
    }
  }

  // ══════════════════════════════════════
  //  RENDER RESULTS
  // ══════════════════════════════════════
  function renderResults(data) {
    if (data.error) {
      resultsContainer.innerHTML = `<div class="alert alert--error">${_esc(data.error)}</div>`;
      return;
    }

    // Build city map
    const cityMap = {};
    const cityList = [];
    data.vendor.forEach(v => {
      if (!cityMap[v.city]) {
        cityMap[v.city] = v;
        cityList.push(v.city);
      }
    });

    let h = '';

    // ── Vendor Card ──
    h += `<div class="vendor-card">`;
    h += `<div class="vendor-card__name">${_esc(data.supplier_name)}</div>`;
    h += `<div class="vendor-card__meta">Present in <strong>${cityList.length}</strong> ${cityList.length === 1 ? 'city' : 'cities'}. Click a city to view POC contacts.</div>`;

    // Brand SCM Banner
    if (data.brand_scm) {
      h += `
        <div class="brand-scm-banner">
          <div class="brand-scm-banner__label">🏢 Brand SCM POC (Top 50 Company)</div>
          <div class="brand-scm-banner__name">${_esc(data.brand_scm.poc)}</div>
          <div class="brand-scm-banner__contact">
            ${data.brand_scm.phone ? `<a href="tel:${_esc(data.brand_scm.phone)}">📞 ${_esc(data.brand_scm.phone)}</a>` : ''}
            ${data.brand_scm.email ? `<a href="mailto:${_esc(data.brand_scm.email)}">✉ ${_esc(data.brand_scm.email)}</a>` : ''}
          </div>
        </div>
      `;
    }

    // City Chips
    h += `<div class="city-chips">`;
    cityList.forEach(c => {
      h += `<button class="city-chip" data-city="${_esc(c)}">${_esc(c)}</button>`;
    });
    h += `</div>`;

    // City Detail Panels
    cityList.forEach(c => {
      const v = cityMap[c];
      const cid = c.replace(/\s+/g, '_');
      h += `
        <div class="city-detail" id="cd-${_esc(cid)}">
          <div class="city-detail__header">
            <span class="city-detail__title">${_esc(c)}</span>
            <span class="city-detail__zone">${_esc(v.zone)}</span>
            &nbsp;
            <span class="city-detail__code">${_esc(v.vendor_code)}</span>
          </div>
          ${_pocBlock('Primary POC', 'primary', v.poc_name, v.poc_phone, v.poc_email)}
          ${_pocBlock('Escalation L1', 'l1', v.l1_name, v.l1_phone, v.l1_email)}
          ${_pocBlock('Escalation L2', 'l2', v.l2_name, v.l2_phone, v.l2_email)}
        </div>
      `;
    });

    h += `</div>`; // close vendor-card

    // ── Tickets Card ──
    if (data.tickets && data.tickets.length > 0) {
      h += `
        <div class="tickets-card">
          <div class="tickets-card__title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" stroke-width="2" stroke-linecap="round">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            Open Tickets (${data.tickets.length})
          </div>
      `;
      data.tickets.forEach(t => {
        const sc = _statusClass(t.status);
        h += `
          <div class="ticket-row">
            <div class="ticket-row__header">
              <span class="ticket-row__id">${_esc(t.ticket_id)}</span>
              <span class="status-badge status-badge--${sc}">${_esc(t.status)}</span>
              <span class="priority-badge">${_esc(t.priority || '')}</span>
            </div>
            <div class="ticket-row__subject">${_esc(t.subject || '')}</div>
            <div class="ticket-row__meta">Assigned: ${_esc(t.assigned_to || '—')} · ${_esc(t.city || '')}</div>
          </div>
        `;
      });
      h += `</div>`;
    }

    resultsContainer.innerHTML = h;

    // ── Bind city chip clicks ──
    resultsContainer.querySelectorAll('.city-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const city = btn.dataset.city;
        resultsContainer.querySelectorAll('.city-chip').forEach(b => b.classList.remove('active'));
        resultsContainer.querySelectorAll('.city-detail').forEach(d => d.classList.remove('show'));
        const el = document.getElementById('cd-' + city.replace(/\s+/g, '_'));
        if (el) { el.classList.add('show'); btn.classList.add('active'); }
      });
    });

    // Auto-click first city
    const firstChip = resultsContainer.querySelector('.city-chip');
    if (firstChip) firstChip.click();

    // Populate city dropdown in ticket form
    const fCity = document.getElementById('fCity');
    fCity.innerHTML = '<option value="">Select city...</option>';
    cityList.forEach(c => {
      fCity.innerHTML += `<option value="${_esc(c)}">${_esc(c)}</option>`;
    });

    // Update ticket badge
    if (data.tickets && data.tickets.length > 0) {
      ticketBadge.textContent = data.tickets.length;
      ticketBadge.style.display = 'inline-block';
    } else {
      ticketBadge.style.display = 'none';
    }

    // Update "My Tickets" tab
    if (data.tickets && data.tickets.length > 0) {
      let th = `
        <div class="tickets-card">
          <div class="tickets-card__title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" stroke-width="2" stroke-linecap="round">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            All Open Tickets (${data.tickets.length})
          </div>
      `;
      data.tickets.forEach(t => {
        const sc = _statusClass(t.status);
        th += `
          <div class="ticket-row">
            <div class="ticket-row__header">
              <span class="ticket-row__id">${_esc(t.ticket_id)}</span>
              <span class="status-badge status-badge--${sc}">${_esc(t.status)}</span>
              <span class="priority-badge">${_esc(t.priority || '')}</span>
            </div>
            <div class="ticket-row__subject">${_esc(t.subject || '')}</div>
            <div class="ticket-row__meta">Assigned: ${_esc(t.assigned_to || '—')} · ${_esc(t.city || '')}</div>
          </div>
        `;
      });
      th += `</div>`;
      ticketListContainer.innerHTML = th;
    } else {
      ticketListContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
          </div>
          <h3>No Open Tickets</h3>
          <p>No active tickets found for this vendor.</p>
        </div>
      `;
    }

    updateHeaderStats();
  }

  // ══════════════════════════════════════
  //  SUBMIT TICKET
  // ══════════════════════════════════════
  async function doSubmit() {
    const code = searchInput.value.trim();
    const email = document.getElementById('fEmail').value.trim();
    const city = document.getElementById('fCity').value;
    const cat = document.getElementById('fCat').value;
    const subj = document.getElementById('fSubj').value.trim();
    const desc = document.getElementById('fDesc').value.trim();
    const pri = document.getElementById('fPri').value;

    if (!code || !city || !cat || !subj) {
      ticketMsg.innerHTML = `<div class="alert alert--error">Please fill vendor code, city, category, and subject.</div>`;
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" class="spinning">
        <circle cx="12" cy="12" r="10" stroke-dasharray="30 70"/>
      </svg>
      Submitting…
    `;
    ticketMsg.innerHTML = '';

    try {
      const result = await DataService.submitTicket(code, city, cat, subj, desc, pri, email);

      if (result.error) {
        ticketMsg.innerHTML = `<div class="alert alert--error">${_esc(result.error)}</div>`;
      } else {
        ticketMsg.innerHTML = `
          <div class="alert alert--success">
            Ticket <strong>${_esc(result.ticket_id)}</strong> created for ${_esc(result.city)}.
            POC (<strong>${_esc(result.poc)}</strong>) has been assigned.
          </div>
        `;
        document.getElementById('fSubj').value = '';
        document.getElementById('fDesc').value = '';
        showToast(`Ticket ${result.ticket_id} created!`, 'success');

        // Refresh results
        if (_lastSearchData) {
          doSearch();
        }
      }
    } catch (err) {
      ticketMsg.innerHTML = `<div class="alert alert--error">${_esc(err.message || err)}</div>`;
    }

    submitBtn.disabled = false;
    submitBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <line x1="22" y1="2" x2="11" y2="13"/>
        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
      Submit Ticket
    `;

    updateHeaderStats();
  }

  // ══════════════════════════════════════
  //  HELPERS
  // ══════════════════════════════════════
  function _pocBlock(title, level, name, phone, email) {
    if (!name && !phone && !email) return '';
    return `
      <div class="poc-block poc-block--${level}">
        <div class="poc-block__title">${_esc(title)}</div>
        <div class="poc-info-grid">
          <span class="lbl">Name</span><span>${_esc(name || '—')}</span>
          <span class="lbl">Phone</span><span>${phone ? `<a href="tel:${_esc(phone)}">${_esc(phone)}</a>` : '—'}</span>
          <span class="lbl">Email</span><span>${email ? `<a href="mailto:${_esc(email)}">${_esc(email)}</a>` : '—'}</span>
        </div>
      </div>
    `;
  }

  function _statusClass(status) {
    const s = (status || '').toLowerCase();
    if (s.indexOf('escalat') > -1) return 'escalated';
    if (s.indexOf('progress') > -1) return 'progress';
    return 'open';
  }

  function _esc(str) {
    const el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

  // ── Toast Notifications ──
  function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
      ${type === 'success' ? '✅' : '⚠️'}
      <span>${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      toast.style.transition = '0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ── Add spinning animation for submit ──
  const style = document.createElement('style');
  style.textContent = `
    .spinning { animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);

  // ── Boot ──
  init();
})();
