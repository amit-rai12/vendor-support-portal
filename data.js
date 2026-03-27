/**
 * ═══════════════════════════════════════════════════════════════
 * Data Layer — Fetches vendor & ticket data from Google Sheets
 * Falls back to localStorage cache when sheet is unreachable.
 * ═══════════════════════════════════════════════════════════════
 */

const DataService = (function () {
  let CONFIG = null;
  let VENDOR_DATA = [];   // Cached vendor rows from Google Sheet
  let TICKET_DATA = [];   // Cached ticket rows from Google Sheet

  // ── Load config.json ──
  async function loadConfig() {
    if (CONFIG) return CONFIG;
    try {
      const resp = await fetch('config.json');
      CONFIG = await resp.json();
    } catch (e) {
      console.warn('Could not load config.json, using defaults');
      CONFIG = _defaultConfig();
    }
    return CONFIG;
  }

  // ── Fetch from local vendor_data.json ──
  async function fetchLocalJson(sheetKey) {
    try {
      const resp = await fetch('vendor_data.json?t=' + new Date().getTime()); // Prevent caching
      const json = await resp.json();
      // sheetKey maps: "FINAL_LIST" → "vendor_list", "TICKETS" → "tickets"
      const keyMap = { 'FINAL_LIST': 'vendor_list', 'TICKETS': 'tickets' };
      const key = keyMap[sheetKey] || sheetKey.toLowerCase();
      return json[key] || null;
    } catch (e) {
      console.warn('Failed to load vendor_data.json:', e.message);
      return null;
    }
  }

  // ── Lookup Vendor (mirrors Apps Script lookupVendor) ──
  async function lookupVendor(vendorCode) {
    if (!vendorCode || vendorCode.trim() === '') {
      return { error: 'Please enter a vendor code or name' };
    }

    const config = await loadConfig();
    const query = vendorCode.trim().toUpperCase();
    const isCodeSearch = /^1N/i.test(query) || /^\d{5,}$/.test(query);

    // Fetch vendor data from local JSON
    let data = await fetchLocalJson('vendor_list');
    if (!data || data.length <= 1) {
      return { error: 'Could not connect to data source. Please ensure vendor_data.json is updated.' };
    }

    VENDOR_DATA = data;

    // Search logic — same as Apps Script
    const results = [];
    const seenCities = {};

    for (let i = 1; i < data.length; i++) {
      const vc = String(data[i][2] || '').trim().toUpperCase();
      const sn = String(data[i][3] || '').trim().toUpperCase();
      const matched = isCodeSearch ? (vc === query) : (sn.indexOf(query) !== -1);

      if (matched) {
        const dk = isCodeSearch
          ? (vc + '|' + String(data[i][1] || '').trim())
          : String(data[i][1] || '').trim();
        if (seenCities[dk]) continue;
        seenCities[dk] = true;

        results.push({
          zone: data[i][0] || '',
          city: data[i][1] || '',
          vendor_code: data[i][2] || '',
          supplier_name: data[i][3] || '',
          poc_name: data[i][4] || '',
          poc_phone: String(data[i][5] || ''),
          poc_email: data[i][6] || '',
          l1_name: data[i][7] || '',
          l1_phone: String(data[i][8] || ''),
          l1_email: data[i][9] || '',
          l2_name: data[i][10] || '',
          l2_phone: String(data[i][11] || ''),
          l2_email: data[i][12] || ''
        });

        if (!isCodeSearch && results.length >= 100) break;
      }
    }

    if (results.length === 0) {
      return { error: 'No vendor found for: ' + query };
    }

    // Match Brand SCM POC
    let brandScm = null;
    const supplierName = results[0].supplier_name.toUpperCase();
    const brandMap = config.brand_scm_map;

    for (const key in brandMap) {
      const keyUpper = key.toUpperCase();
      if (supplierName.indexOf(keyUpper) !== -1 || keyUpper.indexOf(supplierName) !== -1) {
        brandScm = brandMap[key];
        break;
      }
    }
    // Partial match fallback
    if (!brandScm) {
      for (const key in brandMap) {
        const keyBase = key.toUpperCase().split(' - ')[0];
        if (supplierName.indexOf(keyBase) !== -1) {
          brandScm = brandMap[key];
          break;
        }
      }
    }

    // Fetch tickets
    let tickets = [];
    try {
      let ticketData = await fetchLocalJson('tickets');

      if (ticketData && ticketData.length > 1) {
        TICKET_DATA = ticketData;
        for (let j = 1; j < ticketData.length; j++) {
          const tv = String(ticketData[j][2] || '').trim().toUpperCase();
          const tStatus = String(ticketData[j][11] || '').trim().toUpperCase();
          const tSupplier = String(ticketData[j][3] || '').trim().toUpperCase();

          const anyMatch = results.some(r =>
            String(r.vendor_code).toUpperCase() === tv ||
            String(r.supplier_name).toUpperCase() === tSupplier
          );

          if (anyMatch && ['OPEN', 'IN_PROGRESS', 'ESCALATED_L1', 'ESCALATED_L2'].includes(tStatus)) {
            tickets.push({
              ticket_id: ticketData[j][0],
              timestamp: ticketData[j][1],
              category: ticketData[j][6],
              subject: ticketData[j][8],
              status: tStatus,
              assigned_to: ticketData[j][12] || '',
              priority: ticketData[j][10] || '',
              city: ticketData[j][4] || ''
            });
          }
        }
      }
    } catch (e) {
      console.warn('Ticket fetch error:', e);
    }

    // Also include locally raised tickets
    const localTickets = _getLocalTickets(query, results);
    tickets = tickets.concat(localTickets);

    return {
      vendor: results,
      tickets: tickets,
      supplier_name: results[0].supplier_name,
      brand_scm: brandScm
    };
  }

  // ── Submit Ticket ──
  // Since we cannot write to Google Sheets from a static page without auth,
  // tickets are stored locally and you can integrate a backend/Apps Script API later.
  async function submitTicket(vendorCode, city, category, subject, description, priority, raiserEmail) {
    const lookup = await lookupVendor(vendorCode);
    if (lookup.error) return lookup;

    let v = lookup.vendor.find(r => r.city.toUpperCase() === city.toUpperCase());
    if (!v) v = lookup.vendor[0];

    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const ticketId = `TKT-${dateStr}-${Math.floor(Math.random() * 9000) + 1000}`;

    const ticket = {
      ticket_id: ticketId,
      timestamp: now.toISOString(),
      vendor_code: vendorCode,
      supplier_name: v.supplier_name,
      city: v.city,
      zone: v.zone,
      category: category,
      sub_category: '',
      subject: subject,
      description: description,
      priority: priority || 'P3',
      status: 'OPEN',
      assigned_to: v.poc_name,
      assigned_email: v.poc_email,
      l1_name: v.l1_name,
      l1_email: v.l1_email,
      l2_name: v.l2_name,
      l2_email: v.l2_email,
      raiser_email: raiserEmail || 'portal'
    };

    // Save to localStorage
    const stored = JSON.parse(localStorage.getItem('local_tickets') || '[]');
    stored.push(ticket);
    localStorage.setItem('local_tickets', JSON.stringify(stored));

    // Send email notification via EmailJS (if configured)
    await _sendTicketEmail(ticket, config);

    return {
      success: true,
      ticket_id: ticketId,
      city: v.city,
      poc: v.poc_name
    };
  }

  // ── Send ticket confirmation email via EmailJS ──
  async function _sendTicketEmail(ticket, config) {
    try {
      const emailCfg = config.emailjs;
      if (!emailCfg || !emailCfg.enabled || emailCfg.service_id === 'YOUR_EMAILJS_SERVICE_ID') {
        console.log('EmailJS not configured — skipping email notification');
        return;
      }

      if (typeof emailjs === 'undefined') {
        console.warn('EmailJS SDK not loaded');
        return;
      }

      const slaMap = config.sla_hours || { P1: 4, P2: 12, P3: 24, P4: 48 };
      const slaHours = slaMap[ticket.priority] || 24;

      const templateParams = {
        ticket_id: ticket.ticket_id,
        to_email: ticket.raiser_email,
        poc_email: ticket.assigned_email,
        supplier_name: ticket.supplier_name,
        vendor_code: ticket.vendor_code,
        city: ticket.city,
        zone: ticket.zone,
        category: ticket.category,
        priority: ticket.priority,
        subject: ticket.subject,
        description: ticket.description,
        assigned_to: ticket.assigned_to,
        assigned_email: ticket.assigned_email,
        l1_name: ticket.l1_name,
        l1_email: ticket.l1_email,
        sla_hours: slaHours + ' hours'
      };

      await emailjs.send(
        emailCfg.service_id,
        emailCfg.template_id,
        templateParams,
        emailCfg.public_key
      );
      console.log('Ticket email sent successfully');
    } catch (e) {
      console.warn('Email notification failed (non-blocking):', e.message || e);
    }
  }

  // Get locally raised tickets matching the search
  function _getLocalTickets(query, results) {
    const stored = JSON.parse(localStorage.getItem('local_tickets') || '[]');
    return stored.filter(t => {
      const tStatus = t.status.toUpperCase();
      if (!['OPEN', 'IN_PROGRESS', 'ESCALATED_L1', 'ESCALATED_L2'].includes(tStatus)) return false;
      return results.some(r =>
        String(r.vendor_code).toUpperCase() === String(t.vendor_code).toUpperCase() ||
        String(r.supplier_name).toUpperCase() === String(t.supplier_name).toUpperCase()
      );
    }).map(t => ({
      ticket_id: t.ticket_id,
      timestamp: t.timestamp,
      category: t.category,
      subject: t.subject,
      status: t.status,
      assigned_to: t.assigned_to,
      priority: t.priority,
      city: t.city
    }));
  }

  // Get config
  async function getConfig() {
    return await loadConfig();
  }

  // Default config fallback
  function _defaultConfig() {
    return {
      google_sheet_id: '1xWn-dKaCdnhOif1Et-9vCzXkHkdkus4VHI9tjuG5WoQ',
      sheets: { vendor_list: 'FINAL_LIST', tickets: 'TICKETS' },
      brand_scm_map: {},
      ticket_categories: ['PO_ISSUE', 'GRN_ISSUE', 'PAYMENT', 'MARGIN', 'APPOINTMENT', 'DN_PICKUP', 'QUALITY', 'STOCK_OUT', 'OTHER'],
      sla_hours: { P1: 4, P2: 12, P3: 24, P4: 48 }
    };
  }

  return {
    loadConfig,
    lookupVendor,
    submitTicket,
    getConfig
  };
})();
