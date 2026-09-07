// ============================================================
//  HD LEADS AUTOMATION SYSTEM — REFERENCE COPY (version-controlled)
//  ------------------------------------------------------------
//  This is Sean's EXTERNAL Google Apps Script (runs under
//  HDLeads@ghsbarrie.ca) that parses Home Depot lead emails and
//  writes them to the "HD Leads Log" Google Sheet. The GWA portal
//  only READS that sheet (src/lib/leads.ts, by HEADER NAME) and
//  writes No-Good status back to columns O/P/Q (src/lib/leadsWrite.ts);
//  this .gs is NOT executed by the Next.js app — it is kept here so the
//  parsing evolves with history and the portal stays in step.
//
//  PORTAL CONTRACT (do not break):
//   - Keep the 18 headers exactly as setupLeadsLog() defines them
//     (A Date Received … R Date Reported). The portal maps columns by
//     header text, so renames silently drop that field.
//   - Status values the portal understands: "Forwarded",
//     "⚠️ No Contact on File", "No Good" (No-Good detector = /no\s*good/i).
//   - For LIVE leads to appear, run with TEST_MODE:false so rows land in
//     the "Leads Log" tab (the portal reads the first tab that has a
//     "Date Received" header).
//   - Same spreadsheet on both sides: LEADS_LOG_ID here ==
//     HD_LEADS_SHEET_ID in the portal (1dM9bsv0YOME-xLW-SvugAX8taWMM1dkAvsUAYGCb6lk).
//
//  FRENCH SUPPORT (2026-09-07 revision, from real FR samples):
//   - Gmail search matches EN subject "New Home Services Customer Lead"
//     OR FR subject "Nouveau prospect pour les Services".
//   - parseLead() is bilingual for every field (Identifiant du rendez-vous,
//     Nom du service, Magasin, Renseignements sur votre client, Emplacement
//     du projet, S'agit-il d'une urgence, Détails du service, Renseignements
//     supplémentaires). Emergency Non/Oui normalized to No/Yes.
//   - French leads report formatDetected = "Format C (French)".
// ============================================================

// ── CONFIGURATION ────────────────────────────────────────────
var CONFIG = {

  // Confirmed from live sheet — checked twice
  // Sheet name: Internal contact sheet FOR HD LEADS
  // Owner: sean@ghsbarrie.ca — shared with HDLeads@ghsbarrie.ca
  CONTACT_SHEET_ID   : "1qZEkOuFFQcjhhoDusvs3mptzfMWvRiuwgOWB0F5tRkA",
  LEADS_LOG_ID       : "1dM9bsv0YOME-xLW-SvugAX8taWMM1dkAvsUAYGCb6lk",

  REPLY_TO_EMAIL     : "HDLeads@ghsbarrie.ca",
  GMAIL_LABEL        : "HD-Leads-Processed",

  MAX_PER_RUN        : 20,
  CHECK_INTERVAL_MIN : 15,

  // ── TEST MODE ─────────────────────────────────────────────
  // true  = emails go ONLY to TEST_EMAIL
  //         logs to TEST - Leads Log tab
  //         threads NEVER marked processed
  //         dedup via sheet — trigger will NOT flood
  //         yellow TEST banner shows real routing
  // false = LIVE — emails go to real offices
  TEST_MODE          : true,
  TEST_EMAIL         : "sean@ghsbarrie.ca",

  // Days back to search in TEST MODE
  // 30 for manual test run — leads exist back to June
  // Change to 7 once new leads flow daily
  // Ignored in LIVE mode
  TEST_LOOKBACK_DAYS : 30
};


// ── CUSTOM MENU — appears when spreadsheet is opened ─────────
// Single onOpen() — no duplicates
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("HD Reports")
    .addItem("Refresh Lead Summary",    "generateLeadSummary")
    .addSeparator()
    .addItem("Refresh No Good Summary", "generateNoGoodSummary")
    .addToUi();
}


// ── MAIN ENTRY POINT — called by trigger ─────────────────────
function runAll() {
  processNewLeads();
  processNoGoodReplies();
  syncNoGoodToReport();
}


// ── PROCESS NEW LEADS ─────────────────────────────────────────
function processNewLeads() {

  // FLOOD PREVENTION: LockService
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
      query = 'from:info@homedepot.ca {subject:"New Home Services Customer Lead" subject:"Nouveau prospect pour les Services"} after:' + dateStr;
      Logger.log("TEST MODE — searching after " + dateStr + " — emails to " + CONFIG.TEST_EMAIL);
    } else {
      query = 'from:info@homedepot.ca {subject:"New Home Services Customer Lead" subject:"Nouveau prospect pour les Services"} -label:' + CONFIG.GMAIL_LABEL;
      Logger.log("LIVE MODE — processing unprocessed leads.");
    }

    var threads = GmailApp.search(query, 0, CONFIG.MAX_PER_RUN);

    if (threads.length === 0) {
      Logger.log("No leads found.");
      return;
    }
    Logger.log("Found " + threads.length + " lead(s) to evaluate.");

    var contactMap     = buildContactMap();
    var processedLabel = getOrCreateLabel(CONFIG.GMAIL_LABEL);
    var ss             = SpreadsheetApp.openById(CONFIG.LEADS_LOG_ID);
    var logTabName     = CONFIG.TEST_MODE ? "TEST - Leads Log" : "Leads Log";
    var logSheet       = ss.getSheetByName(logTabName) || ss.getSheetByName("Leads Log");

    if (!logSheet) {
      Logger.log("ERROR: Cannot find tab '" + logTabName + "'. Run setupLeadsLog() first.");
      return;
    }

    // FLOOD PREVENTION: Read all existing Booking IDs once before loop
    var existingIds = getExistingBookingIds(logSheet);
    Logger.log("Sheet has " + Object.keys(existingIds).length + " existing booking IDs.");

    var processed = 0;

    threads.forEach(function(thread) {
      try {
        var message  = thread.getMessages()[0];

        // Use getPlainBody() — confirmed fix from real email analysis
        // getBody() collapses two-column HTML table onto one line
        var bodyText = message.getPlainBody();
        if (!bodyText || bodyText.trim().length < 50) {
          Logger.log("No plain text — falling back to HTML strip on " + thread.getId());
          bodyText = stripHtml(message.getBody());
        }

        if (!bodyText || bodyText.trim().length < 20) {
          Logger.log("Empty body on thread " + thread.getId() + " — skipping.");
          return;
        }

        var lead = parseLead(bodyText, message);

        if (!lead.bookingId) {
          Logger.log("No Booking ID on thread " + thread.getId() + " — skipping.");
          return;
        }

        // FLOOD PREVENTION: Skip if already in sheet
        if (existingIds[lead.bookingId]) {
          Logger.log("SKIP — Booking ID " + lead.bookingId + " already in sheet.");
          return;
        }
        existingIds[lead.bookingId] = true;

        var recipients  = contactMap[lead.storeNumber] || [];
        var actualRecip = CONFIG.TEST_MODE ? [CONFIG.TEST_EMAIL] : recipients;
        var status      = recipients.length > 0 ? "Forwarded" : "⚠️ No Contact on File";

        if (actualRecip.length > 0) {
          sendLeadEmail(actualRecip, lead, recipients);
          Logger.log("✅ Lead " + lead.bookingId + " | Store " + lead.storeNumber +
                     " → " + actualRecip.join(", "));
        } else {
          Logger.log("⚠️ No email for Store " + lead.storeNumber +
                     ". Lead " + lead.bookingId + " logged only.");
          if (!CONFIG.TEST_MODE) sendMissingContactAlert(lead);
        }

        appendLeadToLog(logSheet, lead, recipients, status);
        processed++;

        if (!CONFIG.TEST_MODE) {
          thread.addLabel(processedLabel);
          thread.markRead();
        }

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


// ── PARSE LEAD — Format C and Format D ───────────────────────
function parseLead(text, message) {

  // Normalize line endings
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Strip asterisks — Gmail plain text wraps bold in *asterisks*
  // Confirmed from all 5 real leads: *Store:7226 * → Store:7226
  text = text.replace(/\*/g, "");

  // Collapse whitespace but preserve newlines
  text = text
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Detect format
  // Format C English: "HOME SERVICES LEAD RECEIVED"
  // Format C French:  "NOUVEAU PROSPECT POUR LES SERVICES"
  // Format D English: "HOME SERVICES. REQUEST RECEIVED"
  // French Format C uses same field structure as English Format C
  var isFrench  = /NOUVEAU PROSPECT|Identifiant du rendez-vous|Nom du service|Magasin|Renseignements sur votre client/i.test(text);
  var isFormatD = !isFrench && (/REQUEST RECEIVED/i.test(text) || /Booking ID No:\d/i.test(text));

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
    for (var i = 0; i < lines.length; i++) {
      if (labelPattern.test(lines[i])) return i;
    }
    return -1;
  }

  // ── BOOKING ID ────────────────────────────────────────────
  // English: "Booking ID No : 701780675"
  // French:  "Identifiant du rendez-vous : 701780675"
  var bookingId = "";
  var bidMatch  = text.match(/(?:Booking ID No|Identifiant du rendez-vous)\s*:\s*(\d+)/i);
  if (bidMatch) bookingId = bidMatch[1].trim();

  // ── SERVICE NAME ──────────────────────────────────────────
  // English: "Service Name" then next line
  // French:  "Nom du service" then next line
  var serviceName = "";
  if (!isFormatD) {
    serviceName = nextLineAfter(/^(Service Name|Nom du service)\s*$/i);
  } else {
    var bidIdx = lineIndexOf(/Booking ID No/i);
    if (bidIdx > 0) {
      for (var b = bidIdx - 1; b >= 0; b--) {
        var candidate = lines[b].trim();
        if (candidate && candidate !== "." &&
            !/REQUEST RECEIVED|HOME SERVICES|doers get more done|customer lead|contact the customer/i.test(candidate)) {
          serviceName = candidate;
          break;
        }
      }
    }
  }

  // ── STORE NUMBER ──────────────────────────────────────────
  // English: "Store" label then number next line
  // French:  "Magasin" label then number next line
  var storeNumber = "";
  if (!isFormatD) {
    var storeIdx = lineIndexOf(/^(Store|Magasin)\s*$/i);
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

  // ── CONTACT PREFERENCE ────────────────────────────────────
  // English: "Customer Preferred Contact Method:" or "Customer Contact Preference:"
  // French:  "Méthode de contact de préférence du client:"
  var contactPref = nextLineAfter(/Customer (Preferred Contact Method|Contact Preference)|Méthode de contact de préférence du client/i);

  // ── CUSTOMER NAME, PHONE, EMAIL ───────────────────────────
  // English: "Your Customer Information"
  // French:  "Renseignements sur votre client"
  var customerName  = "";
  var customerPhone = "";
  var customerEmail = "";

  var custIdx = lineIndexOf(/Your Customer Information|Renseignements sur votre client/i);
  if (custIdx >= 0) {
    var custLines = [];
    var stopAtCust = /Service Address|Project Location|Emplacement du projet|Is this an emergency|S'agit-il d'une urgence|Additional|Renseignements supplémentaires/i;
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
        // Format D: "Phone +1 7057465884"
        customerPhone = ln.replace(/^Phone\s+/i, "").trim();
      } else if (!customerPhone && /^\+?\d[\d\s\(\)\-\.]{7,}/.test(ln)) {
        // Format C: "+1(905)616-8119"
        customerPhone = ln;
      } else if (!ln.match(/@/) && !ln.match(/^Phone\s/i) && !ln.match(/^\+?\d/)) {
        if (!customerName) {
          customerName = ln;
        } else {
          // Format D: second line is last name
          customerName = customerName + " " + ln;
        }
      }
    }
    customerName = customerName.trim();
  }

  // ── PROJECT ADDRESS ───────────────────────────────────────
  // English: "Project Location" or "Service Address"
  // French:  "Emplacement du projet"
  var projectAddress = "";
  var addrIdx = lineIndexOf(/^(Project Location|Service Address|Emplacement du projet)\s*$/i);
  if (addrIdx >= 0) {
    var addrParts = [];
    var addrStop  = /^(Is this an emergency|S'agit-il d'une urgence|Service Details|Détails du service|Additional Information|Additional Notes|Renseignements supplémentaires|Financing|The information)/i;
    for (var a = addrIdx + 1; a < lines.length && addrParts.length < 4; a++) {
      var al = lines[a].trim();
      if (!al || al === ".") continue;
      if (addrStop.test(al)) break;
      addrParts.push(al);
    }
    projectAddress = addrParts.join(", ");
  }

  // ── EMERGENCY — Format C only ─────────────────────────────
  // English: "Is this an emergency :" then "No" or "Yes"
  // French:  "S'agit-il d'une urgence ? :" then "Non" or "Oui"
  var isEmergency = "";
  if (!isFormatD) {
    var emergRaw = nextLineAfter(/^(Is this an emergency|S'agit-il d'une urgence)/i);
    // Normalize French values to English for consistency in sheet
    if (emergRaw.toLowerCase() === "non") isEmergency = "No";
    else if (emergRaw.toLowerCase() === "oui") isEmergency = "Yes";
    else isEmergency = emergRaw;
  }

  // ── SERVICE DETAILS — Format C only ──────────────────────
  // English: "Service Details"
  // French:  "Détails du service"
  var serviceDetails = "";
  if (!isFormatD) {
    var sdIdx = lineIndexOf(/^(Service Details|Détails du service)\s*$/i);
    if (sdIdx >= 0) {
      var sdParts = [];
      var sdStop  = /^(Additional Information|Renseignements supplémentaires|Financing|Is this an emergency|S'agit-il d'une urgence|The information)/i;
      for (var sd = sdIdx + 1; sd < lines.length; sd++) {
        var sdl = lines[sd].trim();
        if (!sdl || sdl === ".") continue;
        if (sdStop.test(sdl)) break;
        sdParts.push(sdl);
      }
      serviceDetails = sdParts.join(" ").trim();
    }
  }

  // ── ADDITIONAL INFO / NOTES ───────────────────────────────
  // English: "Additional Information" or "Additional Notes"
  // French:  "Renseignements supplémentaires"
  var additionalInfo = "";
  var aiIdx = lineIndexOf(/^(Additional Information|Additional Notes|Renseignements supplémentaires)\s*$/i);
  if (aiIdx >= 0) {
    var aiParts = [];
    var aiStop  = /^(Financing|The information in this Internet|Service Details|Détails du service|--|-----)/i;
    for (var ai = aiIdx + 1; ai < lines.length; ai++) {
      var ail = lines[ai].trim();
      if (!ail) continue;
      if (ail === ".") continue;
      if (aiStop.test(ail)) break;
      aiParts.push(ail);
    }
    additionalInfo = aiParts.join(" ").trim();
  }

  // ── FINANCING — Format C only ─────────────────────────────
  var financing = "";
  if (!isFormatD) {
    financing = nextLineAfter(/^Financing\s*$/i);
  }

  // ── DATE RECEIVED ─────────────────────────────────────────
  var dateReceived = "";
  if (message) {
    try {
      dateReceived = Utilities.formatDate(
        message.getDate(),
        Session.getScriptTimeZone(),
        "yyyy-MM-dd HH:mm"
      );
    } catch(e) {
      Logger.log("Date error: " + e.message);
    }
  }

  return {
    bookingId      : bookingId,
    storeNumber    : storeNumber,
    serviceName    : serviceName,
    contactPref    : contactPref,
    customerName   : customerName,
    customerPhone  : customerPhone,
    customerEmail  : customerEmail,
    projectAddress : projectAddress,
    isEmergency    : isEmergency,
    serviceDetails : serviceDetails,
    additionalInfo : additionalInfo,
    financing      : financing,
    dateReceived   : dateReceived,
    formatDetected : isFormatD ? "Format D" : isFrench ? "Format C (French)" : "Format C"
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
      ? realRecipients.join(", ")
      : "No contact on file for Store " + storeDisplay;
    testBanner =
      '<div style="background:#fff176;border:2px solid #f9a825;border-radius:4px;' +
      'padding:12px 16px;margin-bottom:16px;font-size:13px;">' +
      '<strong>TEST MODE — In live mode this email would go to:</strong><br>' +
      wouldGoTo + '</div>';
  }

  var html = [
    '<div style="font-family:Arial,sans-serif;max-width:620px;border:1px solid #ddd;border-radius:6px;overflow:hidden;">',
    testBanner,

    // Header — no emoji, plain text only
    // Confirmed: house emoji renders as ?????? on iOS/Android
    '<div style="background:#f96302;padding:18px 22px;">',
    '<h2 style="color:#fff;margin:0;font-size:20px;">New Home Depot Lead</h2>',
    '<p style="color:#fff;margin:8px 0 0;font-size:15px;">',
    '<strong>IMPORTANT: Customers must be contacted within 24 hours of receiving this email.</strong>',
    '</p></div>',

    '<div style="padding:22px;background:#fff;">',

    '<table style="width:100%;border-collapse:collapse;margin-bottom:20px;">',
    tRow("Booking ID",    lead.bookingId,        true),
    tRow("Store",         storeDisplay,           false),
    tRow("Service",       lead.serviceName,       true),
    tRow("Date Received", lead.dateReceived,      false),
    tRow("Emergency?",    lead.isEmergency || "", true),
    '</table>',

    '<h3 style="color:#333;border-bottom:2px solid #f96302;padding-bottom:6px;margin-top:0;">',
    'Customer Information</h3>',
    '<table style="width:100%;border-collapse:collapse;margin-bottom:20px;">',
    tRow("Name",               lead.customerName,   true),
    tRow("Phone",              lead.customerPhone,  false),
    tRow("Email",              lead.customerEmail,  true),
    tRow("Contact Preference", lead.contactPref,    false),
    tRow("Project Address",    lead.projectAddress, true),
    '</table>',

    lead.serviceDetails
      ? '<h3 style="color:#333;border-bottom:2px solid #f96302;padding-bottom:6px;">Service Details</h3>' +
        '<p style="background:#f9f9f9;padding:12px;border-radius:4px;font-size:14px;margin-top:8px;">' +
        lead.serviceDetails + '</p>'
      : "",

    lead.additionalInfo
      ? '<h3 style="color:#333;border-bottom:2px solid #f96302;padding-bottom:6px;">Additional Information</h3>' +
        '<p style="background:#f9f9f9;padding:12px;border-radius:4px;font-size:14px;margin-top:8px;">' +
        lead.additionalInfo + '</p>'
      : "",

    lead.financing
      ? '<h3 style="color:#333;border-bottom:2px solid #f96302;padding-bottom:6px;">Financing</h3>' +
        '<p style="background:#f9f9f9;padding:12px;border-radius:4px;font-size:14px;margin-top:8px;">' +
        lead.financing + '</p>'
      : "",

    '<div style="background:#fff8e1;border:1px solid #ffe082;border-radius:4px;',
    'padding:16px;margin-top:24px;font-size:13px;">',
    '<strong>Is this lead unusable?</strong><br><br>',
    'Reply to this email with the subject line exactly as shown:<br><br>',
    '<div style="background:#eee;padding:8px 12px;border-radius:4px;',
    'font-family:monospace;font-size:14px;display:inline-block;">',
    'NO GOOD: ' + lead.bookingId,
    '</div><br><br>',
    'Include a brief reason. Every "No Good" submission helps Home Depot improve future lead quality. By flagging unqualified leads, we can reduce wasted leads and lower unnecessary costs for all service providers.',
    '</div>',

    '</div></div>'
  ].join("");

  var plain =
    (CONFIG.TEST_MODE ? "[TEST] " : "") +
    "New HD Lead — Booking #" + lead.bookingId + "\n" +
    "Store: "      + storeDisplay           + "\n" +
    "Service: "    + lead.serviceName       + "\n" +
    "Date: "       + lead.dateReceived      + "\n\n" +
    "IMPORTANT: Customers must be contacted within 24 hours.\n\n" +
    "CUSTOMER\n" +
    "Name: "       + lead.customerName      + "\n" +
    "Phone: "      + lead.customerPhone     + "\n" +
    "Email: "      + lead.customerEmail     + "\n" +
    "Preference: " + lead.contactPref       + "\n" +
    "Address: "    + lead.projectAddress    + "\n\n" +
    (lead.serviceDetails ? "Service Details: " + lead.serviceDetails + "\n\n" : "") +
    (lead.additionalInfo ? "Additional Info: " + lead.additionalInfo + "\n\n" : "") +
    (lead.financing      ? "Financing: "       + lead.financing      + "\n\n" : "") +
    "To flag as unusable reply with subject: NO GOOD: " + lead.bookingId + "\n" +
    "Include a brief reason. Every \"No Good\" submission helps Home Depot improve future lead quality. By flagging unqualified leads, we can reduce wasted leads and lower unnecessary costs for all service providers.";

  GmailApp.sendEmail(
    recipients.join(","),
    subject,
    plain,
    {
      htmlBody : html,
      replyTo  : CONFIG.REPLY_TO_EMAIL,
      name     : "HD Leads"
    }
  );
}

function tRow(label, value, shaded) {
  var bg = shaded ? "#f5f5f5" : "#ffffff";
  return '<tr style="background:' + bg + ';">' +
    '<td style="padding:8px 10px;font-weight:bold;width:38%;color:#555;font-size:13px;">' +
    label + '</td>' +
    '<td style="padding:8px 10px;font-size:13px;">' + (value || "—") + '</td></tr>';
}


// ── MISSING CONTACT ALERT ─────────────────────────────────────
function sendMissingContactAlert(lead) {
  var admin = Session.getEffectiveUser().getEmail();
  GmailApp.sendEmail(
    admin,
    "HD Lead Not Forwarded — No contact for Store " + (lead.storeNumber || "Unknown"),
    "Lead received for Store " + (lead.storeNumber || "Unknown") + " but no email on file.\n\n" +
    "Booking ID: "  + lead.bookingId     + "\n" +
    "Customer: "    + lead.customerName  + "\n" +
    "Phone: "       + lead.customerPhone + "\n" +
    "Address: "     + lead.projectAddress + "\n\n" +
    "Add this store to the Internal contact sheet and forward manually.",
    { replyTo: CONFIG.REPLY_TO_EMAIL, name: "HD Leads System" }
  );
}


// ── LOG LEAD TO SHEET ─────────────────────────────────────────
// Phone written with apostrophe prefix — confirmed fix for #ERROR!
// Google Sheets sees "'" prefix and treats value as plain text
// regardless of what character the phone number starts with
// Verified: +1(905)616-8119 causes Formula parse error without this fix

function appendLeadToLog(sheet, lead, recipients, status) {
  sheet.appendRow([
    lead.dateReceived,                                    // A — Date Received
    lead.bookingId,                                       // B — Booking ID
    lead.storeNumber,                                     // C — Store #
    lead.serviceName,                                     // D — Service
    lead.customerName,                                    // E — Customer Name
    lead.customerPhone ? "'" + lead.customerPhone : "",   // F — Phone (apostrophe forces plain text)
    lead.customerEmail,                                   // G — Email
    lead.projectAddress,                                  // H — Project Address
    lead.contactPref,                                     // I — Contact Preference
    lead.isEmergency,                                     // J — Emergency?
    lead.serviceDetails,                                  // K — Service Details
    lead.additionalInfo,                                  // L — Additional Info
    lead.financing,                                       // M — Financing
    recipients.join(", "),                                // N — Forwarded To
    status,                                               // O — Status
    "",                                                   // P — No Good Reason
    "",                                                   // Q — Reported to HD?
    ""                                                    // R — Date Reported
  ]);
}


// ── PROCESS NO GOOD REPLIES ───────────────────────────────────
function processNoGoodReplies() {
  var threads = GmailApp.search(
    'subject:"NO GOOD:" -label:HD-NoGood-Processed newer_than:30d'
  );
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
      thread.addLabel(ngLabel);
      thread.markRead();
      Logger.log("No Good processed: Booking ID " + idMatch[1]);
    } catch(e) {
      Logger.log("ERROR processing No Good reply: " + e.message);
    }
  });
}

function markNoGoodInLog(sheet, bookingId, reason) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === String(bookingId).trim()) {
      sheet.getRange(i + 1, 15).setValue("No Good");          // O — Status
      sheet.getRange(i + 1, 16).setValue(                     // P — No Good Reason
        reason ? extractReplyText(reason) : "No reason provided"
      );
      sheet.getRange(i + 1, 17).setValue("Pending — Report to HD"); // Q
      sheet.getRange(i + 1, 1, 1, sheet.getLastColumn()).setBackground("#fce8e6");
      Logger.log("Marked No Good: Booking ID " + bookingId);
      return;
    }
  }
  Logger.log("No Good: Booking ID " + bookingId + " not found in log — check correct tab is being searched.");
}


// ── EXTRACT REPLY TEXT — strips quoted original email ─────────
// Confirmed patterns from real NO GOOD replies (checked twice):
//
//  Gmail web/Android : "On Mon, Jul 6, 2026 at 9:42 AM HD Leads wrote:"
//  Gmail iOS/iPhone  : "On Jul 6, 2026, at 9:42 AM, HD Leads wrote:"
//  French Gmail      : "Le 6 juil. 2026, à 9:42, HD Leads a écrit :"
//  Outlook separator : "________" (8+ underscores)
//  Outlook dashes    : "--------" (8+ dashes)
//  Outlook header    : "From: HD Leads" on its own line
//  Universal         : Lines starting with ">"
//
//  All 10 scenarios confirmed before writing — see audit above.

function extractReplyText(body) {
  if (!body || body.trim() === "") return "No reason provided";

  var lines = body.split("\n");
  var replyLines = [];

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();

    // Stop at any quoted text marker — confirmed from all email clients
    if (
      line.match(/^>/)                           ||  // Universal > prefix
      line.match(/^On .{5,} wrote\s*:/i)         ||  // Gmail web / Android
      line.match(/^On .{5,} a écrit\s*:/i)       ||  // French Gmail
      line.match(/^_{8,}/)                       ||  // Outlook underscores
      line.match(/^-{8,}/)                       ||  // Outlook dashes
      line.match(/^From:\s+/i)                   ||  // Outlook From: header
      line.match(/^Sent:\s+/i)                   ||  // Outlook Sent: header
      line.match(/^-{3,}\s*Original Message\s*-{3,}/i) // Standard separator
    ) {
      break;
    }

    // Collect non-empty lines as the actual reply text
    if (line) replyLines.push(line);
  }

  var result = replyLines.join(" ").trim();

  // If nothing found above the quoted section — no reason was typed
  if (!result || result.length === 0) return "No reason provided";

  // Cap at 300 characters
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
  for (var j = 1; j < ngData.length; j++) {
    existing[String(ngData[j][1]).trim()] = true;
  }

  for (var i = 1; i < logData.length; i++) {
    var status    = String(logData[i][14]).trim(); // Column O
    var bookingId = String(logData[i][1]).trim();
    if (status === "No Good" && !existing[bookingId]) {
      ngSheet.appendRow([
        new Date(),
        bookingId,
        logData[i][2],   // Store #
        logData[i][4],   // Customer Name
        logData[i][3],   // Service
        logData[i][15],  // No Good Reason
        "Pending",
        ""
      ]);
      existing[bookingId] = true;
    }
  }
}


// ── BUILD CONTACT MAP ─────────────────────────────────────────
// Returns { "7076": ["max@cawshomeservices.ca", ...], ... }
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
    for (var c = 1; c < data[i].length; c++) {
      emails = emails.concat(extractEmails(String(data[i][c])));
    }

    var seen = {};
    var deduped = [];
    emails.forEach(function(e) {
      var key = e.toLowerCase();
      if (!seen[key]) { seen[key] = true; deduped.push(e); }
    });
    map[storeNum] = deduped;
  }
  return map;
}

function extractEmails(text) {
  return text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
}


// ── BUILD STORE MAP — for reports ─────────────────────────────
// Returns { "7076": { name: "Beacon Hill", region: "CALGARY" }, ... }
// Confirmed store format: "7076 - Beacon Hill"
// Confirmed region in column index 2

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

    // Extract name after dash: "7076 - Beacon Hill" → "Beacon Hill"
    var nameMatch = storeCell.match(/^\d{4}\s*-\s*(.+)$/);
    var storeName = nameMatch ? nameMatch[1].trim() : storeCell;

    map[storeNum] = {
      name   : storeName,
      region : areaCell || "Unknown"
    };
  }
  return map;
}


// ── GENERATE LEAD SUMMARY REPORT ─────────────────────────────
function generateLeadSummary() {
  var ss         = SpreadsheetApp.getActiveSpreadsheet();
  var logTabName = CONFIG.TEST_MODE ? "TEST - Leads Log" : "Leads Log";
  var leadsSheet = ss.getSheetByName(logTabName) || ss.getSheetByName("Leads Log");

  if (!leadsSheet) {
    SpreadsheetApp.getUi().alert("Cannot find the " + logTabName + " tab.");
    return;
  }

  var leadsData = leadsSheet.getDataRange().getValues();

  // Get or create report tab
  var reportSheet = ss.getSheetByName("Lead Summary Report");
  if (!reportSheet) reportSheet = ss.insertSheet("Lead Summary Report");
  reportSheet.clearContents();
  reportSheet.clearFormats();

  var storeMap = buildStoreMap();

  // Collect all years and months from data
  var availableYears  = {};
  var availableMonths = {};
  for (var i = 1; i < leadsData.length; i++) {
    var ds = String(leadsData[i][0]).trim();
    if (ds.length < 7) continue;
    var yr = ds.substring(0, 4);
    var mo = ds.substring(5, 7);
    if (yr.match(/^\d{4}$/)) availableYears[yr]  = true;
    if (mo.match(/^\d{2}$/)) availableMonths[mo] = true;
  }

  var yearList  = Object.keys(availableYears).sort();
  var monthList = Object.keys(availableMonths).sort();

  var monthNames = {
    "01":"January","02":"February","03":"March","04":"April",
    "05":"May","06":"June","07":"July","08":"August",
    "09":"September","10":"October","11":"November","12":"December"
  };

  var monthOptions = ["All Months"];
  monthList.forEach(function(m) { monthOptions.push(monthNames[m] + " (" + m + ")"); });
  var yearOptions = ["All Years"].concat(yearList);

  // Title and filter controls
  reportSheet.getRange("A1").setValue("HD LEADS — SUMMARY REPORT");
  reportSheet.getRange("A1").setFontSize(14).setFontWeight("bold").setFontColor("#f96302");

  reportSheet.getRange("A2").setValue("Filter by Year:").setFontWeight("bold");
  reportSheet.getRange("B2").setValue(yearOptions[yearOptions.length - 1]);
  reportSheet.getRange("C2").setValue("Filter by Month:").setFontWeight("bold");
  reportSheet.getRange("D2").setValue("All Months");

  reportSheet.getRange("B2").setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(yearOptions, true).setAllowInvalid(false).build()
  );
  reportSheet.getRange("D2").setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(monthOptions, true).setAllowInvalid(false).build()
  );

  reportSheet.getRange("A3")
    .setValue("Generated: " + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm"))
    .setFontColor("#888888").setFontStyle("italic");
  reportSheet.getRange("A4")
    .setValue("To refresh: change filters above then click  HD Reports > Refresh Lead Summary")
    .setFontColor("#1565c0").setFontStyle("italic");

  // Read filter selections
  var selectedYear  = String(reportSheet.getRange("B2").getValue()).trim();
  var selectedMonth = String(reportSheet.getRange("D2").getValue()).trim();
  var filterYear    = selectedYear  === "All Years"  ? null : selectedYear;
  var monthCodeMatch = selectedMonth.match(/\((\d{2})\)/);
  var filterMonth   = selectedMonth === "All Months" ? null : (monthCodeMatch ? monthCodeMatch[1] : null);

  // Count leads per store
  var seen        = {};
  var storeCounts = {};

  for (var r = 1; r < leadsData.length; r++) {
    var row       = leadsData[r];
    var dateStr   = String(row[0]).trim();
    var bookingId = String(row[1]).trim();
    var storeNum  = String(row[2]).trim();
    var status    = String(row[14]).trim(); // Column O

    if (!bookingId) continue;
    if (seen[bookingId]) continue;
    seen[bookingId] = true;

    if (filterYear  && dateStr.substring(0, 4) !== filterYear)  continue;
    if (filterMonth && dateStr.substring(5, 7) !== filterMonth) continue;

    var storeKey = (storeNum && storeNum.match(/^\d{4}$/)) ? storeNum : "BLANK";

    if (!storeCounts[storeKey]) {
      storeCounts[storeKey] = { total: 0, forwarded: 0, noContact: 0, noGood: 0 };
    }
    storeCounts[storeKey].total++;
    if (status === "Forwarded")                    storeCounts[storeKey].forwarded++;
    else if (status.indexOf("No Contact") >= 0)    storeCounts[storeKey].noContact++;
    else if (status === "No Good")                 storeCounts[storeKey].noGood++;
  }

  var ROW_START = 6;
  var storeKeys = Object.keys(storeCounts);

  if (storeKeys.length === 0) {
    reportSheet.getRange("A6").setValue("No leads found for the selected filter period.")
      .setFontColor("#c00000").setFontWeight("bold");
    formatSummarySheet(reportSheet);
    return;
  }

  // Headers
  var headers = ["Store #","Store Name","Region","Total Leads","Forwarded","No Contact on File","No Good"];
  reportSheet.getRange(ROW_START, 1, 1, headers.length).setValues([headers]);
  reportSheet.getRange(ROW_START, 1, 1, headers.length)
    .setBackground("#f96302").setFontColor("#ffffff").setFontWeight("bold").setFontSize(11);

  // Build rows
  var rows = [];
  storeKeys.forEach(function(storeKey) {
    var info   = storeKey === "BLANK"
      ? { name: "Unidentified Store", region: "—" }
      : (storeMap[storeKey] || { name: "Unknown Store", region: "Unknown" });
    var counts = storeCounts[storeKey];
    rows.push([
      storeKey === "BLANK" ? "Blank" : storeKey,
      info.name,
      info.region,
      counts.total,
      counts.forwarded,
      counts.noContact,
      counts.noGood
    ]);
  });

  // Sort by region then store number
  rows.sort(function(a, b) {
    if (a[2] < b[2]) return -1;
    if (a[2] > b[2]) return  1;
    if (a[0] < b[0]) return -1;
    if (a[0] > b[0]) return  1;
    return 0;
  });

  var currentRow  = ROW_START + 1;
  var shade       = false;
  var lastRegion  = null;
  var regionTotals = {};
  var grandTotal  = { total: 0, forwarded: 0, noContact: 0, noGood: 0 };

  rows.forEach(function(row) {
    var region = row[2];

    // Region subtotal when region changes
    if (lastRegion !== null && region !== lastRegion) {
      writeSummaryRegionRow(reportSheet, currentRow, lastRegion, regionTotals[lastRegion]);
      currentRow++;
      shade = false;
    }

    reportSheet.getRange(currentRow, 1, 1, row.length).setValues([row]);
    reportSheet.getRange(currentRow, 1, 1, row.length)
      .setBackground(shade ? "#f9f9f9" : "#ffffff");
    if (row[5] > 0) reportSheet.getRange(currentRow, 6).setBackground("#fff3e0");
    if (row[6] > 0) reportSheet.getRange(currentRow, 7).setBackground("#fce8e6");

    if (!regionTotals[region]) regionTotals[region] = { total:0, forwarded:0, noContact:0, noGood:0 };
    regionTotals[region].total     += row[3];
    regionTotals[region].forwarded += row[4];
    regionTotals[region].noContact += row[5];
    regionTotals[region].noGood    += row[6];

    grandTotal.total     += row[3];
    grandTotal.forwarded += row[4];
    grandTotal.noContact += row[5];
    grandTotal.noGood    += row[6];

    lastRegion = region;
    shade      = !shade;
    currentRow++;
  });

  // Final region subtotal
  if (lastRegion) {
    writeSummaryRegionRow(reportSheet, currentRow, lastRegion, regionTotals[lastRegion]);
    currentRow++;
  }

  // Grand total
  currentRow++;
  reportSheet.getRange(currentRow, 1, 1, 7).setValues([[
    "GRAND TOTAL", "", "",
    grandTotal.total, grandTotal.forwarded, grandTotal.noContact, grandTotal.noGood
  ]]);
  reportSheet.getRange(currentRow, 1, 1, 7)
    .setBackground("#f96302").setFontColor("#ffffff").setFontWeight("bold").setFontSize(12);

  formatSummarySheet(reportSheet);

  SpreadsheetApp.getUi().alert(
    "Lead Summary Report updated!\n\n" +
    "Period: " + (filterYear || "All Years") + " / " + (filterMonth ? monthNames[filterMonth] : "All Months") + "\n" +
    "Total Leads: "         + grandTotal.total     + "\n" +
    "Forwarded: "           + grandTotal.forwarded + "\n" +
    "No Contact on File: "  + grandTotal.noContact + "\n" +
    "No Good: "             + grandTotal.noGood
  );
}

function writeSummaryRegionRow(sheet, row, region, totals) {
  sheet.getRange(row, 1, 1, 7).setValues([[
    region + " TOTAL", "", "",
    totals.total, totals.forwarded, totals.noContact, totals.noGood
  ]]);
  sheet.getRange(row, 1, 1, 7)
    .setBackground("#ffe0b2").setFontWeight("bold").setFontColor("#e65100");
}

function formatSummarySheet(sheet) {
  sheet.setColumnWidth(1, 110);
  sheet.setColumnWidth(2, 200);
  sheet.setColumnWidth(3, 130);
  sheet.setColumnWidth(4, 110);
  sheet.setColumnWidth(5, 110);
  sheet.setColumnWidth(6, 160);
  sheet.setColumnWidth(7, 100);
  sheet.setFrozenRows(6);
}


// ── GENERATE NO GOOD REPORT SUMMARY ──────────────────────────
function generateNoGoodSummary() {
  var ss         = SpreadsheetApp.getActiveSpreadsheet();
  var logTabName = CONFIG.TEST_MODE ? "TEST - Leads Log" : "Leads Log";
  var leadsSheet = ss.getSheetByName(logTabName) || ss.getSheetByName("Leads Log");

  if (!leadsSheet) {
    SpreadsheetApp.getUi().alert("Cannot find the " + logTabName + " tab.");
    return;
  }

  var leadsData = leadsSheet.getDataRange().getValues();
  var storeMap  = buildStoreMap();

  var ngSheet = ss.getSheetByName("No Good Report Summary");
  if (!ngSheet) ngSheet = ss.insertSheet("No Good Report Summary");
  ngSheet.clearContents();
  ngSheet.clearFormats();

  // Collect years and months from No Good leads only
  var availableYears  = {};
  var availableMonths = {};
  for (var i = 1; i < leadsData.length; i++) {
    if (String(leadsData[i][14]).trim() !== "No Good") continue;
    var ds = String(leadsData[i][0]).trim();
    if (ds.length < 7) continue;
    availableYears[ds.substring(0,4)]  = true;
    availableMonths[ds.substring(5,7)] = true;
  }

  var yearList  = Object.keys(availableYears).sort();
  var monthList = Object.keys(availableMonths).sort();

  var monthNames = {
    "01":"January","02":"February","03":"March","04":"April",
    "05":"May","06":"June","07":"July","08":"August",
    "09":"September","10":"October","11":"November","12":"December"
  };

  var monthOptions = ["All Months"];
  monthList.forEach(function(m) { monthOptions.push(monthNames[m] + " (" + m + ")"); });
  var yearOptions = ["All Years"].concat(yearList);

  // Title and filter controls
  ngSheet.getRange("A1").setValue("HD LEADS — NO GOOD REPORT");
  ngSheet.getRange("A1").setFontSize(14).setFontWeight("bold").setFontColor("#c0392b");

  ngSheet.getRange("A2").setValue("Filter by Year:").setFontWeight("bold");
  ngSheet.getRange("B2").setValue(yearOptions[yearOptions.length - 1] || "All Years");
  ngSheet.getRange("C2").setValue("Filter by Month:").setFontWeight("bold");
  ngSheet.getRange("D2").setValue("All Months");

  if (yearOptions.length > 1) {
    ngSheet.getRange("B2").setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInList(yearOptions, true).setAllowInvalid(false).build()
    );
  }
  if (monthOptions.length > 1) {
    ngSheet.getRange("D2").setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInList(monthOptions, true).setAllowInvalid(false).build()
    );
  }

  ngSheet.getRange("A3")
    .setValue("Generated: " + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm"))
    .setFontColor("#888888").setFontStyle("italic");
  ngSheet.getRange("A4")
    .setValue("To refresh: change filters above then click  HD Reports > Refresh No Good Summary")
    .setFontColor("#c0392b").setFontStyle("italic");

  // Read filter selections
  var selectedYear   = String(ngSheet.getRange("B2").getValue()).trim();
  var selectedMonth  = String(ngSheet.getRange("D2").getValue()).trim();
  var filterYear     = selectedYear  === "All Years"  ? null : selectedYear;
  var monthCodeMatch = selectedMonth.match(/\((\d{2})\)/);
  var filterMonth    = selectedMonth === "All Months" ? null : (monthCodeMatch ? monthCodeMatch[1] : null);

  // Collect No Good leads
  var seen     = {};
  var ngRows   = [];
  var regionNG = {};
  var grandNG  = 0;

  for (var r = 1; r < leadsData.length; r++) {
    var row       = leadsData[r];
    var dateStr   = String(row[0]).trim();
    var bookingId = String(row[1]).trim();
    var storeNum  = String(row[2]).trim();
    var status    = String(row[14]).trim();  // Column O
    var reason    = String(row[15]).trim();  // Column P
    var reported  = String(row[16]).trim();  // Column Q

    if (!bookingId) continue;
    if (status !== "No Good") continue;
    if (seen[bookingId]) continue;
    seen[bookingId] = true;

    if (filterYear  && dateStr.substring(0, 4) !== filterYear)  continue;
    if (filterMonth && dateStr.substring(5, 7) !== filterMonth) continue;

    var storeKey = (storeNum && storeNum.match(/^\d{4}$/)) ? storeNum : "BLANK";
    var info     = storeKey === "BLANK"
      ? { name: "Unidentified Store", region: "—" }
      : (storeMap[storeKey] || { name: "Unknown Store", region: "Unknown" });

    ngRows.push([
      dateStr.length >= 10 ? dateStr.substring(0, 10) : dateStr,
      bookingId,
      storeKey === "BLANK" ? "Blank" : storeKey,
      info.name,
      info.region,
      reason   || "No reason provided",
      reported || "Not yet reported"
    ]);

    if (!regionNG[info.region]) regionNG[info.region] = 0;
    regionNG[info.region]++;
    grandNG++;
  }

  // Headers
  var ROW_START = 6;
  var ngHeaders = ["Date Received","Booking ID","Store #","Store Name","Region","No Good Reason","Reported to HD?"];
  ngSheet.getRange(ROW_START, 1, 1, ngHeaders.length).setValues([ngHeaders]);
  ngSheet.getRange(ROW_START, 1, 1, ngHeaders.length)
    .setBackground("#c0392b").setFontColor("#ffffff").setFontWeight("bold").setFontSize(11);

  if (ngRows.length === 0) {
    ngSheet.getRange(ROW_START + 1, 1)
      .setValue("No No Good leads found for the selected filter period.")
      .setFontColor("#c00000").setFontWeight("bold");
    formatNGSheet(ngSheet);
    return;
  }

  // Sort by region then date
  ngRows.sort(function(a, b) {
    if (a[4] < b[4]) return -1;
    if (a[4] > b[4]) return  1;
    if (a[0] < b[0]) return -1;
    if (a[0] > b[0]) return  1;
    return 0;
  });

  var currentRow = ROW_START + 1;
  var lastRegion = null;
  var shade      = false;

  ngRows.forEach(function(row) {
    var region = row[4];

    if (lastRegion !== null && region !== lastRegion) {
      ngSheet.getRange(currentRow, 1, 1, 7).setValues([[
        "", "", "", lastRegion + " TOTAL", "", regionNG[lastRegion] + " No Good lead(s)", ""
      ]]);
      ngSheet.getRange(currentRow, 1, 1, 7)
        .setBackground("#f5c6c6").setFontWeight("bold");
      currentRow++;
      shade = false;
    }

    ngSheet.getRange(currentRow, 1, 1, row.length).setValues([row]);
    ngSheet.getRange(currentRow, 1, 1, row.length)
      .setBackground(shade ? "#fff5f5" : "#ffffff");
    if (String(row[6]).indexOf("Not yet") >= 0) {
      ngSheet.getRange(currentRow, 7).setBackground("#fff3e0");
    }

    lastRegion = region;
    shade      = !shade;
    currentRow++;
  });

  // Final region subtotal
  if (lastRegion) {
    ngSheet.getRange(currentRow, 1, 1, 7).setValues([[
      "", "", "", lastRegion + " TOTAL", "", regionNG[lastRegion] + " No Good lead(s)", ""
    ]]);
    ngSheet.getRange(currentRow, 1, 1, 7)
      .setBackground("#f5c6c6").setFontWeight("bold");
    currentRow++;
  }

  // Grand total
  currentRow++;
  ngSheet.getRange(currentRow, 1, 1, 7).setValues([[
    "", "", "", "GRAND TOTAL", "", grandNG + " No Good lead(s)", ""
  ]]);
  ngSheet.getRange(currentRow, 1, 1, 7)
    .setBackground("#c0392b").setFontColor("#ffffff").setFontWeight("bold").setFontSize(12);

  formatNGSheet(ngSheet);

  SpreadsheetApp.getUi().alert(
    "No Good Report updated!\n\n" +
    "Period: " + (filterYear || "All Years") + " / " + (filterMonth ? monthNames[filterMonth] : "All Months") + "\n" +
    "Total No Good Leads: " + grandNG
  );
}

function formatNGSheet(sheet) {
  sheet.setColumnWidth(1, 120);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 90);
  sheet.setColumnWidth(4, 200);
  sheet.setColumnWidth(5, 130);
  sheet.setColumnWidth(6, 320);
  sheet.setColumnWidth(7, 180);
  sheet.setFrozenRows(6);
}


// ── SETUP: CREATE LEADS LOG SPREADSHEET ──────────────────────
// Run ONCE if sheet ever needs to be rebuilt from scratch
// Copy the Spreadsheet ID from Execution Log
// Paste into CONFIG.LEADS_LOG_ID above
// Then share with sean@ghsbarrie.ca

function setupLeadsLog() {
  var ss    = SpreadsheetApp.create("HD Leads Log");
  var sheet = ss.getActiveSheet();
  sheet.setName("Leads Log");

  var headers = [
    "Date Received","Booking ID","Store #","Service",
    "Customer Name","Phone","Email","Project Address",
    "Contact Preference","Emergency?","Service Details",
    "Additional Info","Financing","Forwarded To","Status",
    "No Good Reason","Reported to HD?","Date Reported"
  ];

  var hRange = sheet.getRange(1, 1, 1, headers.length);
  hRange.setValues([headers]);
  hRange.setBackground("#f96302").setFontColor("#ffffff")
        .setFontWeight("bold").setFontSize(11);
  sheet.setFrozenRows(1);
  sheet.getRange("F:F").setNumberFormat("@");

  var widths = [140,110,80,130,160,130,200,260,180,80,220,260,160,220,160,260,160,120];
  widths.forEach(function(w, i) { sheet.setColumnWidth(i + 1, w); });

  // TEST tab
  var testSheet = ss.insertSheet("TEST - Leads Log");
  testSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  testSheet.getRange(1, 1, 1, headers.length)
    .setBackground("#1565c0").setFontColor("#ffffff")
    .setFontWeight("bold").setFontSize(11);
  testSheet.setFrozenRows(1);
  testSheet.getRange("F:F").setNumberFormat("@");
  widths.forEach(function(w, i) { testSheet.setColumnWidth(i + 1, w); });

  // No Good Report tab
  var ngSheet   = ss.insertSheet("No Good Report");
  var ngHeaders = ["Date Flagged","Booking ID","Store #","Customer Name","Service","Reason","Reported to HD?","Date Reported"];
  ngSheet.getRange(1, 1, 1, ngHeaders.length).setValues([ngHeaders]);
  ngSheet.getRange(1, 1, 1, ngHeaders.length)
    .setBackground("#c0392b").setFontColor("#ffffff")
    .setFontWeight("bold").setFontSize(11);
  ngSheet.setFrozenRows(1);

  Logger.log("==============================================");
  Logger.log("HD Leads Log created.");
  Logger.log("Spreadsheet ID: " + ss.getId());
  Logger.log("URL: " + ss.getUrl());
  Logger.log("==============================================");
  Logger.log("NEXT STEPS:");
  Logger.log("1. Copy ID above into CONFIG.LEADS_LOG_ID");
  Logger.log("2. Share sheet with sean@ghsbarrie.ca");
  Logger.log("3. Run clearTestData()");
  Logger.log("4. Run testSingleLead()");
  Logger.log("5. Run installTrigger()");
  Logger.log("==============================================");
}


// ── CLEAR TEST DATA ───────────────────────────────────────────
// Run ONCE before clean test run
// Wipes data rows from all tabs — keeps headers and formats

function clearTestData() {
  var ss   = SpreadsheetApp.openById(CONFIG.LEADS_LOG_ID);
  var tabs = ["Leads Log", "TEST - Leads Log", "No Good Report", "No Good Report Summary", "Lead Summary Report"];

  tabs.forEach(function(tabName) {
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) return;
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
    }
    if (tabName === "Leads Log" || tabName === "TEST - Leads Log") {
      sheet.getRange("F:F").setNumberFormat("@");
    }
    Logger.log("Cleared: " + tabName + " (" + (lastRow - 1) + " data rows removed)");
  });

  PropertiesService.getScriptProperties().deleteProperty("lastRunTime");
  Logger.log("All test data cleared. Ready for clean test run.");
}


// ── INSTALL TRIGGER ───────────────────────────────────────────
function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("runAll")
    .timeBased()
    .everyMinutes(CONFIG.CHECK_INTERVAL_MIN)
    .create();
  Logger.log("Trigger installed — runAll() fires every " + CONFIG.CHECK_INTERVAL_MIN + " minutes.");
  Logger.log("TEST MODE: " + CONFIG.TEST_MODE);
  Logger.log("Flood prevention: ACTIVE");
}


// ── TEST: PARSE ONE LEAD — no emails, no sheet writes ─────────
function testSingleLead() {
  var cutoff  = new Date();
  cutoff.setDate(cutoff.getDate() - CONFIG.TEST_LOOKBACK_DAYS);
  var dateStr = Utilities.formatDate(cutoff, Session.getScriptTimeZone(), "yyyy/MM/dd");

  var threads = GmailApp.search(
    'from:info@homedepot.ca {subject:"New Home Services Customer Lead" subject:"Nouveau prospect pour les Services"} after:' + dateStr,
    0, 1
  );

  if (threads.length === 0) {
    Logger.log("No leads found in last " + CONFIG.TEST_LOOKBACK_DAYS + " days.");
    Logger.log("Verify script runs under HDLeads@ghsbarrie.ca.");
    return;
  }

  var message  = threads[0].getMessages()[0];
  var bodyText = message.getPlainBody();
  if (!bodyText || bodyText.trim().length < 50) {
    bodyText = stripHtml(message.getBody());
  }

  var lead    = parseLead(bodyText, message);
  var contacts = buildContactMap();
  var recip   = contacts[lead.storeNumber] || [];

  Logger.log("=== PARSED LEAD ===");
  Logger.log("Format Detected : " + lead.formatDetected);
  Logger.log("Booking ID      : " + lead.bookingId);
  Logger.log("Store Number    : " + lead.storeNumber);
  Logger.log("Service         : " + lead.serviceName);
  Logger.log("Customer Name   : " + lead.customerName);
  Logger.log("Phone           : " + lead.customerPhone);
  Logger.log("Email           : " + lead.customerEmail);
  Logger.log("Address         : " + lead.projectAddress);
  Logger.log("Contact Pref    : " + lead.contactPref);
  Logger.log("Emergency       : " + (lead.isEmergency    || "(blank — Format D)"));
  Logger.log("Service Details : " + (lead.serviceDetails || "(blank)"));
  Logger.log("Additional Info : " + (lead.additionalInfo || "(blank)"));
  Logger.log("Financing       : " + (lead.financing      || "(blank — Format D)"));
  Logger.log("Date Received   : " + lead.dateReceived);
  Logger.log("==================");
  Logger.log("Would route to  : " + (recip.length > 0 ? recip.join(", ") : "NO CONTACT ON FILE"));
  Logger.log("=== END ===");
}


// ── UTILITIES ─────────────────────────────────────────────────
function getOrCreateLabel(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi,  "\n")
    .replace(/<\/p>/gi,       "\n")
    .replace(/<\/div>/gi,     "\n")
    .replace(/<\/tr>/gi,      "\n")
    .replace(/<\/td>/gi,      " ")
    .replace(/<[^>]+>/g,      "")
    .replace(/&nbsp;/g,       " ")
    .replace(/&amp;/g,        "&")
    .replace(/&lt;/g,         "<")
    .replace(/&gt;/g,         ">")
    .replace(/&quot;/g,       '"')
    .replace(/&#39;/g,        "'")
    .replace(/[ \t]{2,}/g,    " ")
    .replace(/\n[ \t]+/g,     "\n")
    .replace(/\n{3,}/g,       "\n\n")
    .trim();
}
