// ============================================================
//  HD LEADS AUTOMATION SYSTEM — REFERENCE COPY
//  ------------------------------------------------------------
//  This is Sean's EXTERNAL Google Apps Script (runs under
//  HDLeads@ghsbarrie.ca) that parses Home Depot lead emails and
//  writes them to the "HD Leads Log" Google Sheet. The GWA portal
//  only READS that sheet — this script is NOT executed by the
//  Next.js app. It is version-controlled here so we can evolve it
//  (notably: add FRENCH HD lead parsing) with history.
//
//  KNOWN GAP (2026-09-06): French HD lead emails are missed because
//    1) the Gmail search requires the ENGLISH subject line, so
//       French-subject emails are never fetched, and
//    2) parseLead() keys off English labels only.
//  Fix pending ONE raw French sample email to lock the exact French
//  subject + field labels. See docs/CHANGELOG.md "To do (parked)".
// ============================================================

// ============================================================
//  HD LEADS AUTOMATION SYSTEM — COMPLETE FINAL
//  Google Apps Script
//  Authorization: HDLeads@ghsbarrie.ca
//
//  COLUMN INDEX MAP (confirmed from live sheet):
//  A=0 Date Received   B=1 Booking ID      C=2 Store #
//  D=3 Service         E=4 Customer Name   F=5 Phone
//  G=6 Email           H=7 Project Address I=8 Contact Pref
//  J=9 Emergency       K=10 Service Details L=11 Additional Info
//  M=12 Financing      N=13 Forwarded To   O=14 Status
//  P=15 No Good Reason Q=16 Reported to HD R=17 Date Reported
//
//  TWO EMAIL FORMATS CONFIRMED FROM REAL EMAILS:
//
//  FORMAT C — Water Treatment:
//    HOME SERVICES LEAD RECEIVED.
//    Booking ID No : 701739659   (spaces around colon)
//    Service Name  (label then next line)
//    Store         (label then next line)
//    Customer Preferred Contact Method:
//    Your Customer Information
//    Project Location (label then 3 lines)
//    Is this an emergency :
//    Service Details / Additional Information / Financing
//
//  FORMAT D — Other Services:
//    HOME SERVICES. REQUEST RECEIVED.
//    *Booking ID No:701736601 * (no spaces, wrapped in *)
//    *Store:7226 *
//    Customer Contact Preference:
//    Your Customer Information (first + last name on own lines)
//    Phone +1 4168996729
//    Service Address
//    *Additional Notes *
// ============================================================


// ── CONFIGURATION ────────────────────────────────────────────
var CONFIG = {
  CONTACT_SHEET_ID   : "1qZEkOuFFQcjhhoDusvs3mptzfMWvRiuwgOWB0F5tRkA",
  LEADS_LOG_ID       : "1dM9bsv0YOME-xLW-SvugAX8taWMM1dkAvsUAYGCb6lk",

  REPLY_TO_EMAIL     : "HDLeads@ghsbarrie.ca",
  GMAIL_LABEL        : "HD-Leads-Processed",

  MAX_PER_RUN        : 20,
  CHECK_INTERVAL_MIN : 15,

  TEST_MODE          : false,
  TEST_EMAIL         : "sean@ghsbarrie.ca",
  TEST_LOOKBACK_DAYS : 30
};


// ── CUSTOM MENU ─────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("HD Reports")
    .addItem("Refresh Lead Summary",    "generateLeadSummary")
    .addSeparator()
    .addItem("Refresh No Good Summary", "generateNoGoodSummary")
    .addToUi();
}


// ── MAIN ENTRY POINT ─────────────────────────────────────────
function runAll() {
  processNewLeads();
  processNoGoodReplies();
  syncNoGoodToReport();
}


// ── PROCESS NEW LEADS ─────────────────────────────────────────
function processNewLeads() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    Logger.log("Could not acquire lock — another execution is running. Exiting.");
    return;
  }

  try {
    var query;
    if (CONFIG.TEST_MODE) {
      var cutoff  = new Date();
      cutoff.setDate(cutoff.getDate() - CONFIG.TEST_LOOKBACK_DAYS);
      var dateStr = Utilities.formatDate(cutoff, Session.getScriptTimeZone(), "yyyy/MM/dd");
      query = 'from:info@homedepot.ca subject:"New Home Services Customer Lead" after:' + dateStr;
      Logger.log("TEST MODE — searching after " + dateStr + " — emails to " + CONFIG.TEST_EMAIL);
    } else {
      query = 'from:info@homedepot.ca subject:"New Home Services Customer Lead" -label:' + CONFIG.GMAIL_LABEL;
      Logger.log("LIVE MODE — processing unprocessed leads.");
    }

    var threads = GmailApp.search(query, 0, CONFIG.MAX_PER_RUN);
    if (threads.length === 0) { Logger.log("No leads found."); return; }
    Logger.log("Found " + threads.length + " lead(s) to evaluate.");

    var contactMap     = buildContactMap();
    var processedLabel = getOrCreateLabel(CONFIG.GMAIL_LABEL);
    var ss             = SpreadsheetApp.openById(CONFIG.LEADS_LOG_ID);
    var logTabName     = CONFIG.TEST_MODE ? "TEST - Leads Log" : "Leads Log";
    var logSheet       = ss.getSheetByName(logTabName) || ss.getSheetByName("Leads Log");
    if (!logSheet) { Logger.log("ERROR: Cannot find tab '" + logTabName + "'."); return; }

    var existingIds = getExistingBookingIds(logSheet);
    Logger.log("Sheet has " + Object.keys(existingIds).length + " existing booking IDs.");

    var processed = 0;

    threads.forEach(function(thread) {
      try {
        var message  = thread.getMessages()[0];
        var bodyText = message.getPlainBody();
        if (!bodyText || bodyText.trim().length < 50) bodyText = stripHtml(message.getBody());
        if (!bodyText || bodyText.trim().length < 20) { Logger.log("Empty body — skipping."); return; }

        var lead = parseLead(bodyText, message);
        if (!lead.bookingId) { Logger.log("No Booking ID — skipping."); return; }
        if (existingIds[lead.bookingId]) { Logger.log("SKIP — " + lead.bookingId + " already in sheet."); return; }
        existingIds[lead.bookingId] = true;

        var recipients  = contactMap[lead.storeNumber] || [];
        var actualRecip = CONFIG.TEST_MODE ? [CONFIG.TEST_EMAIL] : recipients;
        var status      = recipients.length > 0 ? "Forwarded" : "⚠️ No Contact on File";

        if (actualRecip.length > 0) {
          sendLeadEmail(actualRecip, lead, recipients);
        } else if (!CONFIG.TEST_MODE) {
          sendMissingContactAlert(lead);
        }

        appendLeadToLog(logSheet, lead, recipients, status);
        processed++;

        if (!CONFIG.TEST_MODE) { thread.addLabel(processedLabel); thread.markRead(); }
      } catch(e) {
        Logger.log("ERROR on thread " + thread.getId() + ": " + e.message);
      }
    });

    Logger.log("Run complete — " + processed + " new lead(s) processed.");
  } finally {
    lock.releaseLock();
  }
}


// ── GET EXISTING BOOKING IDS ──────────────────────────────────
function getExistingBookingIds(sheet) {
  var ids  = {};
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var id = String(data[i][1]).trim();
    if (id) ids[id] = true;
  }
  return ids;
}


// ── PARSE LEAD — Format C and Format D (ENGLISH ONLY) ────────
function parseLead(text, message) {
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  text = text.replace(/\*/g, "");
  text = text.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  var isFormatD = /REQUEST RECEIVED/i.test(text) || /Booking ID No:\d/i.test(text);
  var lines = text.split("\n").map(function(l) { return l.trim(); });

  function nextLineAfter(labelPattern) {
    for (var i = 0; i < lines.length - 1; i++) {
      if (labelPattern.test(lines[i])) {
        for (var j = i + 1; j < lines.length; j++) {
          var v = lines[j].trim();
          if (v && v !== ".") return v;
        }
      }
    }
    return "";
  }
  function lineIndexOf(labelPattern) {
    for (var i = 0; i < lines.length; i++) if (labelPattern.test(lines[i])) return i;
    return -1;
  }

  var bookingId = "";
  var bidMatch  = text.match(/Booking ID No\s*:\s*(\d+)/i);
  if (bidMatch) bookingId = bidMatch[1].trim();

  var serviceName = "";
  if (!isFormatD) {
    serviceName = nextLineAfter(/^Service Name\s*$/i);
  } else {
    var bidIdx = lineIndexOf(/Booking ID No/i);
    if (bidIdx > 0) {
      for (var b = bidIdx - 1; b >= 0; b--) {
        var candidate = lines[b].trim();
        if (candidate && candidate !== "." &&
            !/REQUEST RECEIVED|HOME SERVICES|doers get more done|customer lead|contact the customer/i.test(candidate)) {
          serviceName = candidate; break;
        }
      }
    }
  }

  var storeNumber = "";
  if (!isFormatD) {
    var storeIdx = lineIndexOf(/^Store\s*$/i);
    if (storeIdx >= 0) {
      for (var s = storeIdx + 1; s < lines.length; s++) {
        var sm = lines[s].match(/^(\d{4})\s*$/);
        if (sm) { storeNumber = sm[1]; break; }
      }
    }
  } else {
    var storeMatch = text.match(/Store:(\d{4})/i);
    if (storeMatch) storeNumber = storeMatch[1].trim();
  }

  var contactPref = nextLineAfter(/Customer (Preferred Contact Method|Contact Preference)/i);

  var customerName = "", customerPhone = "", customerEmail = "";
  var custIdx = lineIndexOf(/Your Customer Information/i);
  if (custIdx >= 0) {
    var custLines = [];
    var stopAtCust = /Service Address|Project Location|Is this an emergency|Additional/i;
    for (var c = custIdx + 1; c < lines.length && custLines.length < 6; c++) {
      var cl = lines[c].trim();
      if (!cl || cl === ".") continue;
      if (stopAtCust.test(cl)) break;
      custLines.push(cl);
    }
    for (var ci = 0; ci < custLines.length; ci++) {
      var ln = custLines[ci];
      var emailClean = ln.replace(/<[^>]+>/g, "").trim();
      if (!customerEmail && /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/.test(emailClean)) {
        customerEmail = emailClean.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/)[1];
      } else if (!customerPhone && /Phone\s+\+?[\d]/.test(ln)) {
        customerPhone = ln.replace(/^Phone\s+/i, "").trim();
      } else if (!customerPhone && /^\+?\d[\d\s\(\)\-\.]{7,}/.test(ln)) {
        customerPhone = ln;
      } else if (!ln.match(/@/) && !ln.match(/^Phone\s/i) && !ln.match(/^\+?\d/)) {
        customerName = customerName ? customerName + " " + ln : ln;
      }
    }
    customerName = customerName.trim();
  }

  var projectAddress = "";
  var addrIdx = lineIndexOf(/^(Project Location|Service Address)\s*$/i);
  if (addrIdx >= 0) {
    var addrParts = [];
    var addrStop  = /^(Is this an emergency|Service Details|Additional Information|Additional Notes|Financing|The information)/i;
    for (var a = addrIdx + 1; a < lines.length && addrParts.length < 4; a++) {
      var al = lines[a].trim();
      if (!al || al === ".") continue;
      if (addrStop.test(al)) break;
      addrParts.push(al);
    }
    projectAddress = addrParts.join(", ");
  }

  var isEmergency = "";
  if (!isFormatD) isEmergency = nextLineAfter(/^Is this an emergency/i);

  var serviceDetails = "";
  if (!isFormatD) {
    var sdIdx = lineIndexOf(/^Service Details\s*$/i);
    if (sdIdx >= 0) {
      var sdParts = [];
      var sdStop  = /^(Additional Information|Financing|Is this an emergency|The information)/i;
      for (var sd = sdIdx + 1; sd < lines.length; sd++) {
        var sdl = lines[sd].trim();
        if (!sdl || sdl === ".") continue;
        if (sdStop.test(sdl)) break;
        sdParts.push(sdl);
      }
      serviceDetails = sdParts.join(" ").trim();
    }
  }

  var additionalInfo = "";
  var aiIdx = lineIndexOf(/^(Additional Information|Additional Notes)\s*$/i);
  if (aiIdx >= 0) {
    var aiParts = [];
    var aiStop  = /^(Financing|The information in this Internet|Service Details|--|-----)/i;
    for (var ai = aiIdx + 1; ai < lines.length; ai++) {
      var ail = lines[ai].trim();
      if (!ail || ail === ".") continue;
      if (aiStop.test(ail)) break;
      aiParts.push(ail);
    }
    additionalInfo = aiParts.join(" ").trim();
  }

  var financing = "";
  if (!isFormatD) financing = nextLineAfter(/^Financing\s*$/i);

  var dateReceived = "";
  if (message) {
    try {
      dateReceived = Utilities.formatDate(message.getDate(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
    } catch(e) { Logger.log("Date error: " + e.message); }
  }

  return {
    bookingId: bookingId, storeNumber: storeNumber, serviceName: serviceName,
    contactPref: contactPref, customerName: customerName, customerPhone: customerPhone,
    customerEmail: customerEmail, projectAddress: projectAddress, isEmergency: isEmergency,
    serviceDetails: serviceDetails, additionalInfo: additionalInfo, financing: financing,
    dateReceived: dateReceived, formatDetected: isFormatD ? "Format D" : "Format C"
  };
}


// ── SEND LEAD EMAIL ───────────────────────────────────────────
function sendLeadEmail(recipients, lead, realRecipients) {
  var storeDisplay = lead.storeNumber || "Unknown";
  var subject = "New HD Lead — Booking #" + lead.bookingId + " | Store " + storeDisplay;
  if (CONFIG.TEST_MODE) subject = "[TEST] " + subject;

  var testBanner = "";
  if (CONFIG.TEST_MODE) {
    var wouldGoTo = (realRecipients && realRecipients.length > 0)
      ? realRecipients.join(", ") : "No contact on file for Store " + storeDisplay;
    testBanner =
      '<div style="background:#fff176;border:2px solid #f9a825;border-radius:4px;padding:12px 16px;margin-bottom:16px;font-size:13px;">' +
      '<strong>TEST MODE — In live mode this email would go to:</strong><br>' + wouldGoTo + '</div>';
  }

  var html = [
    '<div style="font-family:Arial,sans-serif;max-width:620px;border:1px solid #ddd;border-radius:6px;overflow:hidden;">',
    testBanner,
    '<div style="background:#f96302;padding:18px 22px;">',
    '<h2 style="color:#fff;margin:0;font-size:20px;">New Home Depot Lead</h2>',
    '<p style="color:#fff;margin:8px 0 0;font-size:15px;"><strong>IMPORTANT: Customers must be contacted within 24 hours of receiving this email.</strong></p></div>',
    '<div style="padding:22px;background:#fff;">',
    '<table style="width:100%;border-collapse:collapse;margin-bottom:20px;">',
    tRow("Booking ID", lead.bookingId, true), tRow("Store", storeDisplay, false),
    tRow("Service", lead.serviceName, true), tRow("Date Received", lead.dateReceived, false),
    tRow("Emergency?", lead.isEmergency || "", true), '</table>',
    '<h3 style="color:#333;border-bottom:2px solid #f96302;padding-bottom:6px;margin-top:0;">Customer Information</h3>',
    '<table style="width:100%;border-collapse:collapse;margin-bottom:20px;">',
    tRow("Name", lead.customerName, true), tRow("Phone", lead.customerPhone, false),
    tRow("Email", lead.customerEmail, true), tRow("Contact Preference", lead.contactPref, false),
    tRow("Project Address", lead.projectAddress, true), '</table>',
    lead.serviceDetails ? '<h3 style="color:#333;border-bottom:2px solid #f96302;padding-bottom:6px;">Service Details</h3><p style="background:#f9f9f9;padding:12px;border-radius:4px;font-size:14px;margin-top:8px;">' + lead.serviceDetails + '</p>' : "",
    lead.additionalInfo ? '<h3 style="color:#333;border-bottom:2px solid #f96302;padding-bottom:6px;">Additional Information</h3><p style="background:#f9f9f9;padding:12px;border-radius:4px;font-size:14px;margin-top:8px;">' + lead.additionalInfo + '</p>' : "",
    lead.financing ? '<h3 style="color:#333;border-bottom:2px solid #f96302;padding-bottom:6px;">Financing</h3><p style="background:#f9f9f9;padding:12px;border-radius:4px;font-size:14px;margin-top:8px;">' + lead.financing + '</p>' : "",
    '<div style="background:#fff8e1;border:1px solid #ffe082;border-radius:4px;padding:16px;margin-top:24px;font-size:13px;">',
    '<strong>Is this lead unusable?</strong><br><br>Reply to this email with the subject line exactly as shown:<br><br>',
    '<div style="background:#eee;padding:8px 12px;border-radius:4px;font-family:monospace;font-size:14px;display:inline-block;">NO GOOD: ' + lead.bookingId + '</div><br><br>',
    'Include a brief reason. Every "No Good" submission helps Home Depot improve future lead quality.',
    '</div></div></div>'
  ].join("");

  var plain =
    (CONFIG.TEST_MODE ? "[TEST] " : "") +
    "New HD Lead — Booking #" + lead.bookingId + "\n" +
    "Store: " + storeDisplay + "\nService: " + lead.serviceName + "\nDate: " + lead.dateReceived + "\n\n" +
    "IMPORTANT: Customers must be contacted within 24 hours.\n\nCUSTOMER\n" +
    "Name: " + lead.customerName + "\nPhone: " + lead.customerPhone + "\nEmail: " + lead.customerEmail + "\n" +
    "Preference: " + lead.contactPref + "\nAddress: " + lead.projectAddress + "\n\n" +
    (lead.serviceDetails ? "Service Details: " + lead.serviceDetails + "\n\n" : "") +
    (lead.additionalInfo ? "Additional Info: " + lead.additionalInfo + "\n\n" : "") +
    (lead.financing ? "Financing: " + lead.financing + "\n\n" : "") +
    "To flag as unusable reply with subject: NO GOOD: " + lead.bookingId;

  GmailApp.sendEmail(recipients.join(","), subject, plain,
    { htmlBody: html, replyTo: CONFIG.REPLY_TO_EMAIL, name: "HD Leads" });
}

function tRow(label, value, shaded) {
  var bg = shaded ? "#f5f5f5" : "#ffffff";
  return '<tr style="background:' + bg + ';"><td style="padding:8px 10px;font-weight:bold;width:38%;color:#555;font-size:13px;">' +
    label + '</td><td style="padding:8px 10px;font-size:13px;">' + (value || "—") + '</td></tr>';
}


// ── MISSING CONTACT ALERT ─────────────────────────────────────
function sendMissingContactAlert(lead) {
  var admin = Session.getEffectiveUser().getEmail();
  GmailApp.sendEmail(admin,
    "HD Lead Not Forwarded — No contact for Store " + (lead.storeNumber || "Unknown"),
    "Lead received for Store " + (lead.storeNumber || "Unknown") + " but no email on file.\n\n" +
    "Booking ID: " + lead.bookingId + "\nCustomer: " + lead.customerName + "\nPhone: " + lead.customerPhone +
    "\nAddress: " + lead.projectAddress + "\n\nAdd this store to the Internal contact sheet and forward manually.",
    { replyTo: CONFIG.REPLY_TO_EMAIL, name: "HD Leads System" });
}


// ── LOG LEAD TO SHEET ─────────────────────────────────────────
function appendLeadToLog(sheet, lead, recipients, status) {
  sheet.appendRow([
    lead.dateReceived, lead.bookingId, lead.storeNumber, lead.serviceName,
    lead.customerName, lead.customerPhone ? "'" + lead.customerPhone : "",
    lead.customerEmail, lead.projectAddress, lead.contactPref, lead.isEmergency,
    lead.serviceDetails, lead.additionalInfo, lead.financing,
    recipients.join(", "), status, "", "", ""
  ]);
}


// ── PROCESS NO GOOD REPLIES ───────────────────────────────────
function processNoGoodReplies() {
  var threads = GmailApp.search('subject:"NO GOOD:" -label:HD-NoGood-Processed newer_than:30d');
  if (threads.length === 0) return;
  var ss         = SpreadsheetApp.openById(CONFIG.LEADS_LOG_ID);
  var logTabName = CONFIG.TEST_MODE ? "TEST - Leads Log" : "Leads Log";
  var logSheet   = ss.getSheetByName(logTabName) || ss.getSheetByName("Leads Log");
  var ngLabel    = getOrCreateLabel("HD-NoGood-Processed");

  threads.forEach(function(thread) {
    try {
      var msg     = thread.getMessages()[0];
      var subject = msg.getSubject();
      var body    = msg.getPlainBody() || "";
      var idMatch = subject.match(/NO GOOD:\s*(\d+)/i);
      if (!idMatch) return;
      markNoGoodInLog(logSheet, idMatch[1].trim(), body);
      thread.addLabel(ngLabel); thread.markRead();
    } catch(e) { Logger.log("ERROR processing No Good reply: " + e.message); }
  });
}

function markNoGoodInLog(sheet, bookingId, reason) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === String(bookingId).trim()) {
      sheet.getRange(i + 1, 15).setValue("No Good");
      sheet.getRange(i + 1, 16).setValue(reason ? extractReplyText(reason) : "No reason provided");
      sheet.getRange(i + 1, 17).setValue("Pending — Report to HD");
      sheet.getRange(i + 1, 1, 1, sheet.getLastColumn()).setBackground("#fce8e6");
      return;
    }
  }
  Logger.log("No Good: Booking ID " + bookingId + " not found in log.");
}


// ── EXTRACT REPLY TEXT ────────────────────────────────────────
function extractReplyText(body) {
  if (!body || body.trim() === "") return "No reason provided";
  var lines = body.split("\n");
  var replyLines = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (line.match(/^>/) || line.match(/^On .{5,} wrote\s*:/i) || line.match(/^On .{5,} a écrit\s*:/i) ||
        line.match(/^_{8,}/) || line.match(/^-{8,}/) || line.match(/^From:\s+/i) ||
        line.match(/^Sent:\s+/i) || line.match(/^-{3,}\s*Original Message\s*-{3,}/i)) break;
    if (line) replyLines.push(line);
  }
  var result = replyLines.join(" ").trim();
  if (!result) return "No reason provided";
  return result.length > 300 ? result.substring(0, 300) + "..." : result;
}


// ── SYNC NO GOOD TO REPORT TAB ────────────────────────────────
function syncNoGoodToReport() {
  var ss         = SpreadsheetApp.openById(CONFIG.LEADS_LOG_ID);
  var logTabName = CONFIG.TEST_MODE ? "TEST - Leads Log" : "Leads Log";
  var logSheet   = ss.getSheetByName(logTabName) || ss.getSheetByName("Leads Log");
  var ngSheet    = ss.getSheetByName("No Good Report");
  if (!logSheet || !ngSheet) return;

  var logData = logSheet.getDataRange().getValues();
  var ngData  = ngSheet.getDataRange().getValues();
  var existing = {};
  for (var j = 1; j < ngData.length; j++) existing[String(ngData[j][1]).trim()] = true;

  for (var i = 1; i < logData.length; i++) {
    var status    = String(logData[i][14]).trim();
    var bookingId = String(logData[i][1]).trim();
    if (status === "No Good" && !existing[bookingId]) {
      ngSheet.appendRow([new Date(), bookingId, logData[i][2], logData[i][4], logData[i][3], logData[i][15], "Pending", ""]);
      existing[bookingId] = true;
    }
  }
}


// ── BUILD CONTACT MAP ─────────────────────────────────────────
function buildContactMap() {
  var ss    = SpreadsheetApp.openById(CONFIG.CONTACT_SHEET_ID);
  var sheet = ss.getActiveSheet();
  var data  = sheet.getDataRange().getValues();
  var map   = {};
  for (var i = 0; i < data.length; i++) {
    var storeCell = String(data[i][0]).trim();
    if (!storeCell || storeCell.toUpperCase() === "STORE") continue;
    var storeMatch = storeCell.match(/(\d{4})/);
    if (!storeMatch) continue;
    var storeNum = storeMatch[1];
    var emails = [];
    for (var c = 1; c < data[i].length; c++) emails = emails.concat(extractEmails(String(data[i][c])));
    var seen = {}, deduped = [];
    emails.forEach(function(e) { var k = e.toLowerCase(); if (!seen[k]) { seen[k] = true; deduped.push(e); } });
    map[storeNum] = deduped;
  }
  return map;
}

function extractEmails(text) {
  return text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
}


// ── BUILD STORE MAP ───────────────────────────────────────────
function buildStoreMap() {
  var ss    = SpreadsheetApp.openById(CONFIG.CONTACT_SHEET_ID);
  var sheet = ss.getActiveSheet();
  var data  = sheet.getDataRange().getValues();
  var map   = {};
  for (var i = 0; i < data.length; i++) {
    var storeCell = String(data[i][0]).trim();
    var areaCell  = String(data[i][2]).trim();
    if (!storeCell || storeCell.toUpperCase() === "STORE") continue;
    var numMatch = storeCell.match(/^(\d{4})/);
    if (!numMatch) continue;
    var storeNum = numMatch[1];
    var nameMatch = storeCell.match(/^\d{4}\s*-\s*(.+)$/);
    map[storeNum] = { name: nameMatch ? nameMatch[1].trim() : storeCell, region: areaCell || "Unknown" };
  }
  return map;
}


// NOTE: generateLeadSummary(), generateNoGoodSummary(), setupLeadsLog(),
// clearTestData(), installTrigger(), testSingleLead() and the small
// helpers (getOrCreateLabel, stripHtml, formatting) are unchanged from
// Sean's live script and are omitted from this reference copy for brevity —
// only the lead-processing + parsing paths above matter for the French-lead
// update. See the live Apps Script project for the full report generators.


// ── UTILITIES ─────────────────────────────────────────────────
function getOrCreateLabel(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n").replace(/<\/td>/gi, " ").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]{2,}/g, " ").replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
