/**
 * Vendor Self-Service Lookup Web App
 * Deploy: Publish > Deploy as web app > Anyone can access
 */

var POC_SHEET_ID = "1xWn-dKaCdnhOif1Et-9vCzXkHkdkus4VHI9tjuG5WoQ";
var TICKET_SHEET_ID = POC_SHEET_ID;

// Brand SCM POC mapping — Top 50 companies → SCM contact
var BRAND_SCM_MAP = {
  "COCA-COLA INDIA":                    {poc: "Alok", email: "alok.kullu@swiggy.in", phone: "8971608752"},
  "PEPSICO INDIA BEVERAGES":            {poc: "Alok", email: "alok.kullu@swiggy.in", phone: "8971608752"},
  "ITC LIMITED":                        {poc: "Amit Singh", email: "amit.singh5@scootsy.com", phone: "7836810093"},
  "HALDIRAM SNACKS FOOD PRIVATE LIMITED":{poc: "Amit Singh", email: "amit.singh5@scootsy.com", phone: "7836810093"},
  "PEPSICO INDIA FOOD":                 {poc: "Amit Singh", email: "amit.singh5@scootsy.com", phone: "7836810093"},
  "HINDUSTAN UNILEVER LIMITED":          {poc: "Bhargavi", email: "bhargavi.mupparam@swiggy.in", phone: "7483181045"},
  "RECKITT BENCKISER INDIA PVT LTD":    {poc: "Bhargavi", email: "bhargavi.mupparam@swiggy.in", phone: "7483181045"},
  "PARLE PRODUCTS PVT. LTD":            {poc: "Inzamam", email: "mohammed.1@swiggy.in", phone: "9583220544"},
  "BRITANNIA INDUSTRIES LIMITED":        {poc: "Inzamam", email: "mohammed.1@swiggy.in", phone: "9583220544"},
  "MARICO LIMITED":                      {poc: "Inzamam", email: "mohammed.1@swiggy.in", phone: "9583220544"},
  "ITC LIMITED - CIGARETTES":            {poc: "Prajwal", email: "prajwal.s1@scootsy.com", phone: "7090920924"},
  "GODFREY PHILLIPS INDIA LIMITED":      {poc: "Prajwal", email: "prajwal.s1@scootsy.com", phone: "7090920924"},
  "HAPPILO INTERNATIONAL PVT LTD":      {poc: "Shiva", email: "sivashankar.v@scootsy.com", phone: "7013147779"},
  "TATA CONSUMER PRODUCTS LTD":         {poc: "Shiva", email: "sivashankar.v@scootsy.com", phone: "7013147779"},
  "CONNEDIT SOLUTION PVT LTD":          {poc: "Shiva", email: "sivashankar.v@scootsy.com", phone: "7013147779"},
  "LT FOODS LTD":                       {poc: "Shiva", email: "sivashankar.v@scootsy.com", phone: "7013147779"},
  "MONDELEZ INDIA FOODS PRIVATE LIMITED":{poc: "Swetha", email: "swetha.2@scootsy.com", phone: "9008839881"},
  "NESTLE INDIA LTD":                   {poc: "Swetha", email: "swetha.2@scootsy.com", phone: "9008839881"},
  "MARS COSMETICS PVT. LTD.":           {poc: "Vinay", email: "yerigeri.k@scootsy.com", phone: "8088999310"},
  "SCOOTSY LOGISTICS PRIVATE LIMITED- Noice": {poc: "Praveen", email: "", phone: ""},
};

function doGet(e) {
  return HtmlService.createHtmlOutput(HTML_PAGE)
    .setTitle("Swiggy Instamart - Vendor Support Portal")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function lookupVendor(vendorCode) {
  try {
    if (!vendorCode || vendorCode.trim() === "") return { error: "Please enter a vendor code or name" };
    var query = vendorCode.trim().toUpperCase();
    var ss = SpreadsheetApp.openById(POC_SHEET_ID);
    var ws = ss.getSheetByName("FINAL_LIST");
    var data = ws.getDataRange().getValues();
    var isCodeSearch = /^1N/i.test(query) || /^\d{5,}$/.test(query);
    var results = [];
    var seenCities = {};
    for (var i = 1; i < data.length; i++) {
      var vc = String(data[i][2]).trim().toUpperCase();
      var sn = String(data[i][3]).trim().toUpperCase();
      var matched = isCodeSearch ? (vc === query) : (sn.indexOf(query) !== -1);
      if (matched) {
        // For name search: dedup by city only (show one POC per city, not per vendor code)
        // For code search: dedup by vendor_code + city (exact match, fewer results)
        var dk = isCodeSearch ? (vc + "|" + String(data[i][1]).trim()) : String(data[i][1]).trim();
        if (seenCities[dk]) continue;
        seenCities[dk] = true;
        results.push({
          zone: data[i][0] || "", city: data[i][1] || "", vendor_code: data[i][2] || "",
          supplier_name: data[i][3] || "", poc_name: data[i][4] || "",
          poc_phone: String(data[i][5] || ""), poc_email: data[i][6] || "",
          l1_name: data[i][7] || "", l1_phone: String(data[i][8] || ""), l1_email: data[i][9] || "",
          l2_name: data[i][10] || "", l2_phone: String(data[i][11] || ""), l2_email: data[i][12] || ""
        });
        if (!isCodeSearch && results.length >= 100) break;
      }
    }
    if (results.length === 0) return { error: "No vendor found for: " + query };

    // Match Brand SCM POC — check supplier name against BRAND_SCM_MAP
    var brandScm = null;
    var supplierName = results[0].supplier_name.toUpperCase();
    for (var key in BRAND_SCM_MAP) {
      if (supplierName.indexOf(key.toUpperCase()) !== -1 || key.toUpperCase().indexOf(supplierName) !== -1) {
        brandScm = BRAND_SCM_MAP[key];
        break;
      }
    }
    // Also try partial match — e.g. "ITC LIMITED - FOODS" should match "ITC LIMITED"
    if (!brandScm) {
      for (var key in BRAND_SCM_MAP) {
        if (supplierName.indexOf(key.toUpperCase().split(" - ")[0]) !== -1) {
          brandScm = BRAND_SCM_MAP[key];
          break;
        }
      }
    }
    var tickets = [];
    try {
      var tws = ss.getSheetByName("TICKETS");
      if (tws) {
        var td = tws.getDataRange().getValues();
        // COL: 0=ticket_id, 1=timestamp, 2=vendor_code, 3=supplier_name, 4=city,
        // 5=zone, 6=category, 7=sub_cat, 8=subject, 9=desc, 10=priority, 11=status,
        // 12=assigned_to, 13=assigned_email
        for (var j = 1; j < td.length; j++) {
          var tv = String(td[j][2]).trim().toUpperCase();
          var tStatus = String(td[j][11]).trim().toUpperCase();
          var tSupplier = String(td[j][3]).trim().toUpperCase();
          // Match by vendor code OR supplier name (so name searches find tickets)
          var anyMatch = results.some(function(r) {
            return String(r.vendor_code).toUpperCase() === tv || String(r.supplier_name).toUpperCase() === tSupplier;
          });
          if (anyMatch && ["OPEN","IN_PROGRESS","ESCALATED_L1","ESCALATED_L2"].indexOf(tStatus) !== -1) {
            tickets.push({ ticket_id: td[j][0], timestamp: td[j][1], category: td[j][6],
              subject: td[j][8], status: tStatus, assigned_to: td[j][12] || "", priority: td[j][10] || "",
              city: td[j][4] || "" });
          }
        }
      }
    } catch(e) {}
    return { vendor: results, tickets: tickets, supplier_name: results[0].supplier_name, brand_scm: brandScm };
  } catch(e) {
    return { error: "Server error: " + e.message };
  }
}

function submitTicket(vendorCode, city, category, subject, description, priority, raiserEmail) {
  try {
    var lookup = lookupVendor(vendorCode);
    if (lookup.error) return lookup;
    var v = null;
    for (var i = 0; i < lookup.vendor.length; i++) {
      if (lookup.vendor[i].city.toUpperCase() === city.toUpperCase()) { v = lookup.vendor[i]; break; }
    }
    if (!v) v = lookup.vendor[0];
    var ss = SpreadsheetApp.openById(TICKET_SHEET_ID);
    var tws = ss.getSheetByName("TICKETS");
    if (!tws) return { error: "TICKETS tab not found" };
    var now = new Date();
    var ticketId = "TKT-" + Utilities.formatDate(now, "Asia/Kolkata", "yyyyMMdd") + "-" + String(Math.floor(Math.random() * 9000) + 1000);
    // Column order must match COL mapping: A=ticket_id, B=timestamp, C=vendor_code, D=supplier_name,
    // E=city, F=zone, G=category, H=sub_category, I=subject, J=description,
    // K=priority, L=status, M=assigned_to, N=assigned_email, O=esc_l1_name, P=esc_l1_email,
    // Q=esc_l2_name, R=esc_l2_email, S=resolution, T=resolution_date, U=sla_hours, V=sla_breach, W=aging, X=last_action
    tws.appendRow([ticketId, Utilities.formatDate(now, "Asia/Kolkata", "yyyy-MM-dd HH:mm:ss"),
      vendorCode, v.supplier_name, v.city, v.zone, category, "",
      subject, description, priority || "P3", "OPEN",
      v.poc_name, v.poc_email, v.l1_name, v.l1_email, v.l2_name, v.l2_email,
      "", "", "", "", "", "Raised by: " + (raiserEmail || "portal")]);

    // Send confirmation email to the person who raised the ticket
    if (raiserEmail) {
      try {
        var confirmBody = "<div style='font-family:Arial;max-width:600px;margin:auto;'>" +
          "<div style='background:#fc8019;color:white;padding:16px;border-radius:8px 8px 0 0;text-align:center;'>" +
          "<h2 style='margin:0;'>Ticket Raised Successfully</h2></div>" +
          "<div style='padding:20px;border:1px solid #eee;border-top:none;'>" +
          "<p>Hi,</p><p>Your ticket has been created and assigned. Here are the details:</p>" +
          "<table style='width:100%;border-collapse:collapse;font-size:14px;'>" +
          "<tr><td style='padding:8px;border:1px solid #ddd;font-weight:bold;width:140px;'>Ticket ID</td><td style='padding:8px;border:1px solid #ddd;'>" + ticketId + "</td></tr>" +
          "<tr><td style='padding:8px;border:1px solid #ddd;font-weight:bold;'>City</td><td style='padding:8px;border:1px solid #ddd;'>" + v.city + "</td></tr>" +
          "<tr><td style='padding:8px;border:1px solid #ddd;font-weight:bold;'>Category</td><td style='padding:8px;border:1px solid #ddd;'>" + category + "</td></tr>" +
          "<tr><td style='padding:8px;border:1px solid #ddd;font-weight:bold;'>Priority</td><td style='padding:8px;border:1px solid #ddd;'>" + (priority || "P3") + "</td></tr>" +
          "<tr><td style='padding:8px;border:1px solid #ddd;font-weight:bold;'>Subject</td><td style='padding:8px;border:1px solid #ddd;'>" + subject + "</td></tr>" +
          "<tr><td style='padding:8px;border:1px solid #ddd;font-weight:bold;'>Assigned To</td><td style='padding:8px;border:1px solid #ddd;'>" + v.poc_name + " (" + v.poc_email + ")</td></tr>" +
          "<tr><td style='padding:8px;border:1px solid #ddd;font-weight:bold;'>Escalation L1</td><td style='padding:8px;border:1px solid #ddd;'>" + v.l1_name + " (" + v.l1_email + ")</td></tr>" +
          "</table>" +
          "<p style='margin-top:16px;color:#666;font-size:12px;'>SLA: " + (priority === "P1" ? "4 hours" : priority === "P2" ? "12 hours" : priority === "P4" ? "48 hours" : "24 hours") + ". Auto-escalation if unresolved.</p>" +
          "<p style='margin-top:12px;'><a href='https://script.google.com/a/macros/scootsy.com/s/AKfycbxoTbPclTI8PD62PmZlP_TYlZJKyKu7XSLtdxehzdX1gHdi18dyBYmtlzOXzdogWPVK/exec' style='color:#fc8019;'>Track your ticket on the portal</a></p>" +
          "</div></div>";
        MailApp.sendEmail({
          to: raiserEmail,
          subject: "[" + ticketId + "] Ticket Confirmed — " + category + ": " + subject,
          htmlBody: confirmBody
        });
      } catch(e) { /* email send failed — non-blocking */ }
    }
    return { success: true, ticket_id: ticketId, city: v.city, poc: v.poc_name };
  } catch(e) {
    return { error: "Submit error: " + e.message };
  }
}

function testSearch() {
  Logger.log("Starting test...");
  try {
    var result = lookupVendor("1N60000342");
    Logger.log("Result: " + JSON.stringify(result).substring(0, 500));
  } catch(e) {
    Logger.log("ERROR: " + e.message);
  }
}

var HTML_PAGE = '\
<!DOCTYPE html>\
<html>\
<head>\
<meta charset="utf-8">\
<meta name="viewport" content="width=device-width, initial-scale=1">\
<style>\
* { box-sizing: border-box; margin: 0; padding: 0; }\
body { font-family: Segoe UI, Arial, sans-serif; background: #f5f6fa; color: #333; }\
.header { background: linear-gradient(135deg, #fc8019, #e06c10); color: white; padding: 20px; text-align: center; }\
.header h1 { font-size: 1.5em; margin-bottom: 4px; }\
.header p { opacity: 0.9; font-size: 0.9em; }\
.container { max-width: 720px; margin: 20px auto; padding: 0 16px; }\
.search-box { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); margin-bottom: 16px; display:flex; gap:8px; }\
.search-box input { flex:1; padding: 12px 16px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 1em; outline: none; }\
.search-box input:focus { border-color: #fc8019; }\
.search-box button { padding: 12px 24px; background: #fc8019; color: white; border: none; border-radius: 8px; font-size: 1em; cursor: pointer; white-space:nowrap; }\
.search-box button:hover { background: #e06c10; }\
.card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); margin-bottom: 16px; }\
.card h2 { color: #fc8019; font-size: 1.1em; margin-bottom: 12px; border-bottom: 2px solid #fef0e0; padding-bottom: 8px; }\
.info-grid { display: grid; grid-template-columns: 100px 1fr; gap: 4px 12px; font-size: 0.9em; }\
.info-grid .label { color: #888; font-weight: 600; }\
.info-grid a { color: #fc8019; text-decoration: none; }\
.info-grid a:hover { text-decoration: underline; }\
.poc-section { border-radius: 8px; padding: 10px 12px; margin: 6px 0; }\
.poc-primary { background: #fef8f0; }\
.poc-l1 { background: #fff3e0; }\
.poc-l2 { background: #ffebee; }\
.poc-title { font-weight: 700; font-size: 0.82em; margin-bottom: 4px; }\
.poc-primary .poc-title { color: #fc8019; }\
.poc-l1 .poc-title { color: #e65100; }\
.poc-l2 .poc-title { color: #c62828; }\
.city-btn { display: inline-block; background: #fc8019; color: white; padding: 8px 16px; border-radius: 20px; font-size: 0.85em; margin: 3px; cursor: pointer; border: none; font-weight: 600; }\
.city-btn:hover { background: #e06c10; }\
.city-btn.active { background: #333; }\
.city-detail { display:none; margin: 12px 0; border: 1px solid #fef0e0; border-radius: 8px; padding: 14px; }\
.city-detail.show { display: block; }\
.tab-bar { display: flex; gap: 0; margin-bottom: 16px; }\
.tab { padding: 10px 20px; background: #e0e0e0; cursor: pointer; border-radius: 8px 8px 0 0; font-weight: 600; font-size: 0.9em; border: none; }\
.tab.active { background: #fc8019; color: white; }\
.tab-content { display: none; }\
.tab-content.active { display: block; }\
.form-group { margin-bottom: 12px; }\
.form-group label { display: block; font-weight: 600; font-size: 0.85em; margin-bottom: 4px; color: #555; }\
.form-group input, .form-group select, .form-group textarea { width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 0.9em; }\
.form-group textarea { height: 80px; resize: vertical; }\
.submit-btn { background: #fc8019; color: white; border: none; padding: 12px 32px; border-radius: 8px; font-size: 1em; cursor: pointer; font-weight: 600; }\
.submit-btn:hover { background: #e06c10; }\
.error { color: #c62828; padding: 12px; background: #ffebee; border-radius: 8px; margin: 8px 0; }\
.success { color: #2e7d32; background: #e8f5e9; padding: 12px; border-radius: 8px; margin: 8px 0; }\
.loading { text-align: center; padding: 20px; color: #888; }\
.ticket-row { background: #f9fafb; border-radius: 8px; padding: 10px; margin: 6px 0; border-left: 4px solid #fc8019; }\
.status { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 700; }\
.s-open { background: #e3f2fd; color: #1565c0; }\
.s-in_progress { background: #fff3e0; color: #e65100; }\
.s-escalated { background: #ffebee; color: #c62828; }\
</style>\
</head>\
<body>\
<div class="header">\
  <h1>Swiggy Instamart &#8212; Vendor Support Portal</h1>\
  <p>Look up your POC or raise a support ticket</p>\
</div>\
<div class="container">\
  <div class="search-box">\
    <input type="text" id="q" placeholder="Enter Vendor Code (1N60000030) or Name (ITC, Amul...)">\
    <button id="searchBtn">Search</button>\
  </div>\
  <div class="tab-bar">\
    <button class="tab active" data-tab="lookup">POC Lookup</button>\
    <button class="tab" data-tab="ticket">Raise Ticket</button>\
    <button class="tab" data-tab="mytickets">My Tickets</button>\
  </div>\
  <div id="lookup" class="tab-content active">\
    <div id="results"><div class="card"><p style="color:#888;">Enter a vendor code or company name and click Search.</p></div></div>\
  </div>\
  <div id="ticket" class="tab-content">\
    <div class="card">\
      <h2>Raise a Support Ticket</h2>\
      <div class="form-group"><label>Your Email (for ticket updates)</label><input type="email" id="fEmail" placeholder="your.name@company.com"></div>\
      <div class="form-group"><label>City</label><select id="fCity"><option value="">Search vendor first</option></select></div>\
      <div class="form-group"><label>Category</label><select id="fCat"><option value="">Select...</option><option>PO_ISSUE</option><option>GRN_ISSUE</option><option>PAYMENT</option><option>MARGIN</option><option>APPOINTMENT</option><option>DN_PICKUP</option><option>QUALITY</option><option>STOCK_OUT</option><option>OTHER</option></select></div>\
      <div class="form-group"><label>Priority</label><select id="fPri"><option value="P3">P3 - Medium</option><option value="P1">P1 - Critical</option><option value="P2">P2 - High</option><option value="P4">P4 - Low</option></select></div>\
      <div class="form-group"><label>Subject</label><input type="text" id="fSubj" placeholder="Brief description"></div>\
      <div class="form-group"><label>Description</label><textarea id="fDesc" placeholder="Details with PO numbers, SKU codes, etc."></textarea></div>\
      <button class="submit-btn" id="submitBtn">Submit Ticket</button>\
      <div id="ticketMsg"></div>\
    </div>\
  </div>\
  <div id="mytickets" class="tab-content">\
    <div id="ticketList"><div class="card"><p style="color:#888;">Search vendor first to see tickets.</p></div></div>\
  </div>\
</div>\
<script>\
var _cities = [];\
var _data = null;\
\
document.getElementById("searchBtn").addEventListener("click", doSearch);\
document.getElementById("q").addEventListener("keypress", function(e) { if (e.key === "Enter") doSearch(); });\
document.getElementById("submitBtn").addEventListener("click", doSubmit);\
document.querySelectorAll(".tab").forEach(function(t) {\
  t.addEventListener("click", function() {\
    document.querySelectorAll(".tab").forEach(function(x){x.classList.remove("active");});\
    document.querySelectorAll(".tab-content").forEach(function(x){x.classList.remove("active");});\
    t.classList.add("active");\
    document.getElementById(t.getAttribute("data-tab")).classList.add("active");\
  });\
});\
\
function doSearch() {\
  var q = document.getElementById("q").value.trim();\
  if (!q) return;\
  document.getElementById("results").innerHTML = \'<div class="loading">Searching for "\' + q + \'"... (may take 10-15s)</div>\';\
  google.script.run.withSuccessHandler(onResults).withFailureHandler(onError).lookupVendor(q);\
}\
\
function onError(err) {\
  document.getElementById("results").innerHTML = \'<div class="error">Error: \' + (err.message || err) + \'</div>\';\
}\
\
function onResults(data) {\
  _data = data;\
  if (data.error) { document.getElementById("results").innerHTML = \'<div class="error">\' + data.error + \'</div>\'; return; }\
  var cityMap = {}, cityList = [];\
  data.vendor.forEach(function(v) {\
    if (!cityMap[v.city]) { cityMap[v.city] = v; cityList.push(v.city); }\
  });\
  _cities = cityList;\
  var h = \'<div class="card"><h2>\' + data.supplier_name + \'</h2>\';\
  h += \'<p style="color:#666;font-size:0.85em;margin-bottom:10px;">Present in \' + cityList.length + \' cities. Click a city to view POC.</p>\';\
  if (data.brand_scm) {\
    h += \'<div style="background:linear-gradient(135deg,#1565c0,#0d47a1);color:white;border-radius:8px;padding:12px 16px;margin-bottom:12px;">\';\
    h += \'<div style="font-size:0.8em;opacity:0.8;margin-bottom:4px;">BRAND SCM POC (Top 50 Company)</div>\';\
    h += \'<div style="font-size:1.1em;font-weight:700;">\' + data.brand_scm.poc + \'</div>\';\
    if (data.brand_scm.phone) h += \'<a href="tel:\' + data.brand_scm.phone + \'" style="color:#bbdefb;font-size:0.9em;text-decoration:none;">&#128222; \' + data.brand_scm.phone + \'</a> &nbsp; \';\
    if (data.brand_scm.email) h += \'<a href="mailto:\' + data.brand_scm.email + \'" style="color:#bbdefb;font-size:0.9em;text-decoration:none;">&#9993; \' + data.brand_scm.email + \'</a>\';\
    h += \'</div>\';\
  }\
  h += \'<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px;">\';\
  cityList.forEach(function(c) {\
    h += \'<button class="city-btn" data-city="\' + c + \'">\' + c + \'</button>\';\
  });\
  h += \'</div>\';\
  cityList.forEach(function(c) {\
    var v = cityMap[c];\
    h += \'<div class="city-detail" id="cd-\' + c.replace(/\\s/g,"_") + \'">\' ;\
    h += \'<h3 style="margin-bottom:8px;">\' + c + \' <span style="color:#888;font-size:0.8em;">(\' + v.zone + \')</span> <span style="color:#aaa;font-size:0.75em;">\' + v.vendor_code + \'</span></h3>\';\
    h += pocBlock("Primary POC", "poc-primary", v.poc_name, v.poc_phone, v.poc_email);\
    h += pocBlock("Escalation L1", "poc-l1", v.l1_name, v.l1_phone, v.l1_email);\
    h += pocBlock("Escalation L2", "poc-l2", v.l2_name, v.l2_phone, v.l2_email);\
    h += \'</div>\';\
  });\
  h += \'</div>\';\
  if (data.tickets && data.tickets.length > 0) {\
    h += \'<div class="card"><h2>Open Tickets (\' + data.tickets.length + \')</h2>\';\
    data.tickets.forEach(function(t) {\
      var sc = t.status.toLowerCase().indexOf("escalat") > -1 ? "s-escalated" : (t.status.toLowerCase().indexOf("progress") > -1 ? "s-in_progress" : "s-open");\
      h += \'<div class="ticket-row"><strong>\' + t.ticket_id + \'</strong> <span class="status \' + sc + \'">\' + t.status + \'</span> <span style="color:#888;font-size:0.8em;">\' + (t.priority||"") + \'</span><br>\';\
      h += \'<span style="font-size:0.9em;">\' + (t.subject||"") + \'</span><br><span style="color:#888;font-size:0.8em;">Assigned: \' + (t.assigned_to||"") + \'</span></div>\';\
    });\
    h += \'</div>\';\
  }\
  document.getElementById("results").innerHTML = h;\
  document.querySelectorAll(".city-btn").forEach(function(btn) {\
    btn.addEventListener("click", function() {\
      var city = btn.getAttribute("data-city");\
      document.querySelectorAll(".city-btn").forEach(function(b){b.classList.remove("active");});\
      document.querySelectorAll(".city-detail").forEach(function(d){d.classList.remove("show");});\
      var el = document.getElementById("cd-" + city.replace(/\\s/g,"_"));\
      if (el) { el.classList.add("show"); btn.classList.add("active"); }\
    });\
  });\
  var sel = document.getElementById("fCity");\
  sel.innerHTML = \'<option value="">Select city...</option>\';\
  cityList.forEach(function(c) { sel.innerHTML += \'<option value="\' + c + \'">\' + c + \'</option>\'; });\
  document.getElementById("ticketList").innerHTML = (data.tickets && data.tickets.length > 0) ? document.getElementById("results").innerHTML : \'<div class="card"><p>No open tickets</p></div>\';\
}\
\
function pocBlock(title, cls, name, phone, email) {\
  return \'<div class="poc-section \' + cls + \'"><div class="poc-title">\' + title + \'</div><div class="info-grid">\' +\
    \'<span class="label">Name</span><span>\' + name + \'</span>\' +\
    \'<span class="label">Phone</span><span><a href="tel:\' + phone + \'">\' + phone + \'</a></span>\' +\
    \'<span class="label">Email</span><span><a href="mailto:\' + email + \'">\' + email + \'</a></span>\' +\
    \'</div></div>\';\
}\
\
function doSubmit() {\
  var code = document.getElementById("q").value.trim();\
  var email = document.getElementById("fEmail").value.trim();\
  var city = document.getElementById("fCity").value;\
  var cat = document.getElementById("fCat").value;\
  var subj = document.getElementById("fSubj").value;\
  var desc = document.getElementById("fDesc").value;\
  var pri = document.getElementById("fPri").value;\
  if (!code || !city || !cat || !subj) { document.getElementById("ticketMsg").innerHTML = \'<div class="error">Please fill vendor code, city, category, and subject</div>\'; return; }\
  document.getElementById("ticketMsg").innerHTML = \'<div class="loading">Submitting...</div>\';\
  google.script.run.withSuccessHandler(function(r) {\
    if (r.error) { document.getElementById("ticketMsg").innerHTML = \'<div class="error">\' + r.error + \'</div>\'; }\
    else { document.getElementById("ticketMsg").innerHTML = \'<div class="success">Ticket <strong>\' + r.ticket_id + \'</strong> created for \' + r.city + \'. POC (\' + r.poc + \') will be notified.</div>\'; document.getElementById("fSubj").value = ""; document.getElementById("fDesc").value = ""; }\
  }).withFailureHandler(function(e) { document.getElementById("ticketMsg").innerHTML = \'<div class="error">\' + e.message + \'</div>\'; }).submitTicket(code, city, cat, subj, desc, pri, email);\
}\
</script>\
</body>\
</html>';
