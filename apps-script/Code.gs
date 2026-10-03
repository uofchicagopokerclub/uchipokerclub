/** @OnlyCurrentDoc */
/*
  UChicago Poker Club: ledger backend (Google Apps Script, bound to the ledger Google Sheet).

  One-time setup
  1. Create a Google Sheet on the club Google account, and turn on 2-Step Verification for that account.
  2. Extensions > Apps Script. Replace Code.gs with this file. Save.
  3. Reload the Sheet. A "Ledger" menu appears.
       Ledger > Set up sheet             (approve access when asked)
       Ledger > New board password       (shown once: copy it to the board)
       Ledger > Set sign-up code         (share it at meetings)
  4. Apps Script: Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.
     Copy the URL ending in /exec into ledger.apiUrl in content/club.js in the website repo, then commit.
  5. Share the Sheet only with board members who need it, never "Anyone with the link".

  Every week: open www.uchipokerclub.com/ledger/record (unlinked, board password required).

  Security model
  - Public read: names and results of people who have played. Emails never leave the Sheet.
  - Joining needs the sign-up code (6+ characters). Anonymous traffic is capped per minute, so guessing it is impractical.
  - Recording results needs the board password: a generated 96-bit secret, stored only as a SHA-256 hash.
    Requests with the right password are never rate limited, so a flood cannot lock the board out.
  - Changing the password or code needs edit access to this Sheet (your Google login).
  - Sponsor inquiries from the Contact page are saved to the Sponsor inquiries tab, capped per hour.
    Nothing is emailed: the script has no permission to send mail.
  - Mailing-list sign-ups from the site footer go to the Mailing list tab: any email, de-duplicated,
    capped, and never readable from the web.
  - Every write lands in the Log tab. File > Version history restores anything.

  After editing this file: Deploy > Manage deployments > edit > Version: New version. The URL stays the same.
*/

var TERM = "Fall 2026";
var SHEET_NAME = "Players";
var LOG_NAME = "Log";
var LIST_NAME = "Mailing list";
var SPONSOR_NAME = "Sponsor inquiries";
// Shown to visitors when a form cannot take their details. This script never sends email.
var CLUB_EMAIL = "UofChicagoPokerClub@gmail.com";
var FIXED = ["Name", "Email", "Year", "Joined", "Source"]; // columns A to E; weeks start at F
var WEEKS = ["Oct 9", "Oct 16", "Oct 23", "Oct 30", "Nov 6", "Nov 13", "Nov 20"];
var EMAIL_DOMAIN = "uchicago.edu"; // set to "" to accept any email address
var YEARS = ["2027", "2028", "2029", "2030", "Other"];
var CACHE_KEY = "standings";
var MAX_PLAYERS = 3000;      // sign-ups stop past this many rows
var MAX_SUBSCRIBERS = 20000; // mailing-list rows
var MAX_SPONSOR_ROWS = 5000;  // sponsor inquiry rows
var SPONSORS_PER_HOUR = 20;  // keeps a flood from burying the club inbox
var STARTING_STACK = 10000;  // chips each member starts a meeting with (Fall 2026 schedule email)
var MAX_BODY = 100000;       // bytes per request
var MAX_CHIPS = 10000000;    // largest result accepted for one night
var ANON_PER_MINUTE = 300;   // sign-ups plus wrong-password requests, combined

/* ---------- Sheet menu (needs edit access to the Sheet) ---------- */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Ledger")
    .addItem("Set up sheet", "setupSheet")
    .addItem("New board password", "newBoardPasswordPrompt")
    .addItem("Set sign-up code", "signupCodePrompt")
    .addSeparator()
    .addItem("Add a week", "addWeekPrompt")
    .addToUi();
}

function setupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    var header = FIXED.concat(WEEKS);
    sheet.getRange(1, 1, 1, header.length).setNumberFormat("@").setValues([header]).setFontWeight("bold");
  }
  // Text format keeps name, email and year literal: nothing typed into them is treated as a formula.
  sheet.getRange(1, 1, sheet.getMaxRows(), 3).setNumberFormat("@");
  sheet.getRange(2, 4, sheet.getMaxRows() - 1, 1).setNumberFormat("yyyy-mm-dd h:mm");
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);
  logSheet_();
  listSheet_();
  sponsorSheet_();
  ss.toast("Ledger sheet is ready.", "Ledger");
}

function newBoardPasswordPrompt() {
  var ui = SpreadsheetApp.getUi();
  if (props_().getProperty("ADMIN_HASH")) {
    var ok = ui.alert("Replace the board password?",
      "Every device using the old password is signed out and needs the new one.", ui.ButtonSet.YES_NO);
    if (ok !== ui.Button.YES) return;
  }
  var key = createBoardPassword_();
  var html = HtmlService.createHtmlOutput(
    "<div style='font-family:Arial,sans-serif;font-size:14px;line-height:1.5'>" +
    "<p>Copy this now. It is not stored anywhere and will not be shown again.</p>" +
    "<input readonly value='" + key + "' onclick='this.select()' " +
    "style='width:100%;box-sizing:border-box;font:16px monospace;padding:10px;margin:12px 0;border:1px solid #800000'>" +
    "<p style='color:#626262'>Board members enter it once on the Record results page.</p></div>"
  ).setWidth(460).setHeight(210);
  ui.showModalDialog(html, "Board password");
}

function signupCodePrompt() {
  var ui = SpreadsheetApp.getUi();
  var current = props_().getProperty("JOIN_CODE");
  var res = ui.prompt("Sign-up code",
    (current ? "Current code: " + current + "\n\n" : "Sign-ups are closed until a code is set.\n\n") +
    "New code, 6 to 20 letters or numbers. Leave blank to close sign-ups.", ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var out = setSignupCode_(res.getResponseText());
  ui.alert(out.ok ? (out.code ? "Sign-up code is now " + out.code + "." : "Sign-ups are closed.") : out.error);
}

function addWeekPrompt() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt("Add a week", "Column label, for example Jan 8", ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var out = addWeek_(res.getResponseText());
  if (!out.ok) ui.alert(out.error);
}

/* ---------- Public web app ---------- */

// GET /exec: public standings. Names and results only, and only for people who have played.
function doGet() {
  var cache = CacheService.getScriptCache();
  var body = cache.get(CACHE_KEY);
  if (!body) {
    var t = readTable_();
    body = JSON.stringify({
      term: TERM,
      weeks: t.weeks,
      players: t.players
        .filter(function (p) { return p.results.some(function (v) { return v !== null; }); })
        .map(function (p) { return { name: p.name, results: p.results }; }),
      generatedAt: new Date().toISOString()
    });
    cache.put(CACHE_KEY, body, 60);
  }
  return json_(body);
}

// POST /exec: join form and board tool. Body is a JSON string sent as text/plain (no preflight).
function doPost(e) {
  var raw = (e && e.postData && e.postData.contents) || "";
  if (raw.length > MAX_BODY) return json_({ ok: false, error: "Request too large." });
  var busy = { ok: false, error: "The ledger is busy. Try again in a minute." };

  var data;
  try { data = JSON.parse(raw || "{}"); } catch (err) { data = null; }
  if (!data || typeof data !== "object" || Array.isArray(data)) return json_({ ok: false, error: "Something went wrong. Try again." });

  try {
    var action = data.action || "join";
    // Only unauthenticated traffic is throttled: a flood can slow sign-ups but never blocks the board.
    if (action === "join") return json_(allow_("anon", ANON_PER_MINUTE, 60) ? join_(data) : busy);
    if (action === "subscribe") return json_(allow_("anon", ANON_PER_MINUTE, 60) ? subscribe_(data) : busy);
    if (action === "sponsor") {
      var open = allow_("anon", ANON_PER_MINUTE, 60) && allow_("sponsor", SPONSORS_PER_HOUR, 3600);
      return json_(open ? sponsor_(data) : { ok: false, error: "Too many inquiries right now. Email " + CLUB_EMAIL + " instead." });
    }

    var denied = checkBoardPassword_(data.key);
    if (denied) return json_(allow_("anon", ANON_PER_MINUTE, 60) ? { ok: false, auth: true, error: denied } : busy);
    var by = cleanBy_(data.by);

    if (action === "load") return json_({ ok: true, data: getAdminData_() });
    if (action === "save") return json_(saveWeek_(data.week, data.entries, data.startingStack, by));
    if (action === "addPlayer") return json_(addPlayer_(data.name, by));
    return json_({ ok: false, error: "Unknown action." });
  } catch (err) {
    return json_({ ok: false, error: err && err.message ? err.message : "Something went wrong. Try again." });
  }
}

/* ---------- Join ---------- */

function join_(data) {
  if (data.website) return { ok: true, name: "" }; // honeypot: bots fill hidden fields

  // The code is checked before anything else, so a caller without it learns nothing about the form.
  var code = props_().getProperty("JOIN_CODE");
  if (!code) return { ok: false, error: "Sign-ups are closed right now. Ask a board member." };
  if (!safeEqual_(normCode_(data.code), code)) {
    return { ok: false, field: "code", error: "That sign-up code is not right. The board shares it at meetings." };
  }

  var n = validName_(data.name);
  if (n.error) return { ok: false, field: "name", error: n.error };

  var email = clean_(data.email).toLowerCase();
  var emailOk = /^[a-z0-9][a-z0-9._%+-]*@[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(email) && email.length <= 120;
  if (!emailOk) return { ok: false, field: "email", error: "Enter a valid email address." };
  if (EMAIL_DOMAIN && email.slice(-(EMAIL_DOMAIN.length + 1)) !== "@" + EMAIL_DOMAIN) {
    return { ok: false, field: "email", error: "Use your @" + EMAIL_DOMAIN + " email." };
  }

  var year = clean_(data.year);
  if (YEARS.indexOf(year) < 0) return { ok: false, field: "year", error: "Pick your class year." };

  return withLock_(function () {
    var t = readTable_();
    if (t.players.length >= MAX_PLAYERS) return { ok: false, error: "Sign-ups are full. Ask a board member." };
    if (t.players.some(function (p) { return p.email && p.email.toLowerCase() === email; })) {
      return { ok: false, field: "email", error: "That email is already on the ledger. A board member can update your details." };
    }
    var i = indexOfKey_(t.players.map(function (p) { return p.name; }), n.value);
    if (i >= 0 && t.players[i].email) {
      return { ok: false, field: "name", error: "Someone already uses that name. Add a last initial or a nickname." };
    }
    if (i >= 0) {
      // The board added this person at a meeting; signing up fills in their details on the same row.
      t.sheet.getRange(t.players[i].row + 2, 2, 1, 2).setValues([[safe_(email), safe_(year)]]);
      log_("join", t.players[i].name + " (claimed board-added row)", "sign-up form");
      return { ok: true, name: t.players[i].name };
    }
    t.sheet.appendRow([safe_(n.value), safe_(email), safe_(year), new Date(), "form"]);
    log_("join", n.value, "sign-up form");
    return { ok: true, name: n.value };
  });
}

/* ---------- Mailing list ---------- */

// Footer form on every page: First Name, Last Name, Email Address. Any email domain.
// A repeat sign-up answers exactly like a new one, so the form never reveals who is on the list.
function subscribe_(data) {
  if (data.website) return { ok: true }; // honeypot
  var first = validPersonName_(data.fname, 30);
  if (first.error) return { ok: false, field: "fname", error: first.error };
  var last = validPersonName_(data.lname, 30);
  if (last.error) return { ok: false, field: "lname", error: last.error };
  var email = clean_(data.email).toLowerCase();
  var emailOk = /^[a-z0-9][a-z0-9._%+-]*@[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(email) && email.length <= 120;
  if (!emailOk) return { ok: false, field: "email", error: "Enter a valid email address." };

  return withLock_(function () {
    var sheet = listSheet_();
    var rows = sheet.getLastRow() - 1;
    var emails = rows > 0 ? sheet.getRange(2, 3, rows, 1).getValues() : [];
    if (emails.some(function (r) { return String(r[0]).toLowerCase() === email; })) return { ok: true };
    if (rows >= MAX_SUBSCRIBERS) return { ok: false, error: "The mailing list is full. Email the club instead." };
    sheet.appendRow([safe_(first.value), safe_(last.value), safe_(email), new Date(), "website"]);
    return { ok: true };
  });
}

function validPersonName_(raw, max) {
  var v = clean_(raw);
  if (!v) return { error: "Enter your name." };
  if (v.length > max) return { error: "Keep it under " + max + " characters." };
  if (!NAME_RE.test(v)) return { error: "Use letters, numbers, spaces, periods, apostrophes or hyphens." };
  return { value: v };
}

function listSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(LIST_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(LIST_NAME);
    sheet.getRange(1, 1, 1, 5).setValues([["First Name", "Last Name", "Email", "Joined", "Source"]]).setFontWeight("bold");
    sheet.getRange(1, 1, sheet.getMaxRows(), 3).setNumberFormat("@");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/* ---------- Sponsor inquiries ---------- */

// Contact page form: name, company, work email, optional message. Saved to the Sponsor inquiries tab
// for the board to follow up from. Nothing is emailed.
var COMPANY_RE = /^[\p{L}\p{N}][\p{L}\p{N} &.,'\u2019()\/+-]*$/u;

function sponsor_(data) {
  if (data.website) return { ok: true }; // honeypot
  var name = validPersonName_(data.name, 60);
  if (name.error) return { ok: false, field: "name", error: name.error };
  var company = clean_(data.company);
  if (!company) return { ok: false, field: "company", error: "Enter your company." };
  if (company.length > 80 || !COMPANY_RE.test(company)) {
    return { ok: false, field: "company", error: "Use letters, numbers, spaces and basic punctuation, up to 80 characters." };
  }
  var email = clean_(data.email).toLowerCase();
  var emailOk = /^[a-z0-9][a-z0-9._%+-]*@[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(email) && email.length <= 120;
  if (!emailOk) return { ok: false, field: "email", error: "Enter a valid email address." };
  var message = clean_(data.message);
  if (message.length > 1000) return { ok: false, field: "message", error: "Keep the message under 1,000 characters." };

  var saved = withLock_(function () {
    var sheet = sponsorSheet_();
    if (sheet.getLastRow() - 1 >= MAX_SPONSOR_ROWS) return false;
    sheet.appendRow([new Date(), safe_(name.value), safe_(company), safe_(email), safe_(message), "website"]);
    return true;
  });
  if (!saved) return { ok: false, error: "Please email " + CLUB_EMAIL + " instead." };
  log_("sponsor inquiry", company, "contact form");
  return { ok: true, name: name.value };
}

function sponsorSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SPONSOR_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SPONSOR_NAME);
    sheet.getRange(1, 1, 1, 6).setValues([["When", "Name", "Company", "Email", "Message", "Source"]]).setFontWeight("bold");
    sheet.getRange(1, 2, sheet.getMaxRows(), 5).setNumberFormat("@");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/* ---------- Board actions (board password required) ---------- */

function getAdminData_() {
  var t = readTable_();
  var firstEmpty = -1;
  for (var w = 0; w < t.weeks.length && firstEmpty < 0; w++) {
    if (!t.players.some(function (p) { return p.results[w] !== null; })) firstEmpty = w;
  }
  return {
    term: TERM,
    weeks: t.weeks,
    defaultWeek: t.weeks[firstEmpty >= 0 ? firstEmpty : t.weeks.length - 1] || "",
    // A saved 0 means "type profit or loss directly", so only a missing value falls back to the default.
    startingStack: startingStack_(),
    players: t.players.map(function (p) { return { name: p.name, results: p.results }; }) // never emails
  };
}

// entries: [{ name, value }] where value is what was typed (a number) or null to clear the cell.
// With a starting stack, values are end-of-night chip counts and the sheet stores count minus stack.
function saveWeek_(week, entries, startingStack, by) {
  var start = Number(startingStack) || 0;
  if (!(start >= 0 && start <= MAX_CHIPS)) throw new Error("Starting stack must be between 0 and " + MAX_CHIPS + ".");
  if (!Array.isArray(entries) || entries.length > MAX_PLAYERS) throw new Error("Nothing to save.");

  return withLock_(function () {
    var t = readTable_();
    var w = indexOfKey_(t.weeks, week);
    if (w < 0) throw new Error("No week called " + clean_(week) + ".");
    if (!t.players.length) return { ok: true, saved: 0, cleared: 0, missing: [], week: t.weeks[w] };

    var range = t.sheet.getRange(2, FIXED.length + w + 1, t.rowCount, 1);
    var column = range.getValues();
    var names = t.players.map(function (p) { return p.name; });
    var saved = 0, cleared = 0, missing = [];

    entries.forEach(function (e) {
      if (!e || typeof e.name !== "string") throw new Error("Bad entry.");
      var i = indexOfKey_(names, e.name);
      if (i < 0) { missing.push(clean_(e.name).slice(0, 40)); return; }
      var row = t.players[i].row;
      if (e.value === null || e.value === "") { column[row][0] = ""; cleared++; return; }
      var v = typeof e.value === "number" ? e.value : NaN;
      if (!isFinite(v) || Math.abs(v) > MAX_CHIPS) throw new Error("Not a valid number for " + t.players[i].name + ".");
      if (start && v < 0) throw new Error("Chip count for " + t.players[i].name + " cannot be negative.");
      column[row][0] = start ? v - start : v;
      saved++;
    });

    range.setValues(column);
    props_().setProperty("startingStack", String(start));
    clearCache_();
    log_("results", t.weeks[w] + ": " + saved + " saved, " + cleared + " cleared", by);
    return { ok: true, saved: saved, cleared: cleared, missing: missing, week: t.weeks[w] };
  });
}

function startingStack_() {
  var saved = props_().getProperty("startingStack");
  return saved === null ? STARTING_STACK : Number(saved) || 0;
}

function addPlayer_(name, by) {
  var n = validName_(name);
  if (n.error) return { ok: false, error: n.error };
  return withLock_(function () {
    var t = readTable_();
    if (t.players.length >= MAX_PLAYERS) return { ok: false, error: "The ledger is full." };
    if (indexOfKey_(t.players.map(function (p) { return p.name; }), n.value) >= 0) {
      return { ok: false, error: n.value + " is already on the ledger." };
    }
    t.sheet.appendRow([safe_(n.value), "", "", new Date(), "board"]);
    log_("add player", n.value, by);
    return { ok: true, name: n.value };
  });
}

function addWeek_(label) {
  label = clean_(label);
  if (!label || label.length > 20) return { ok: false, error: "Enter a label for the week, up to 20 characters." };
  return withLock_(function () {
    var t = readTable_();
    if (indexOfKey_(t.weeks, label) >= 0) return { ok: false, error: "There is already a week called " + label + "." };
    t.sheet.getRange(1, FIXED.length + t.weeks.length + 1).setNumberFormat("@").setValue(safe_(label)).setFontWeight("bold");
    clearCache_();
    log_("add week", label, "sheet menu");
    return { ok: true, week: label };
  });
}

/* ---------- Secrets ---------- */

function createBoardPassword_() {
  // Utilities.getUuid is backed by a cryptographic random source. 24 hex characters = 96 bits.
  var hex = "";
  while (hex.length < 24) {
    var u = Utilities.getUuid().replace(/-/g, "");
    hex += u.slice(0, 12) + u.slice(13, 16) + u.slice(17); // drop the fixed version and variant digits
  }
  var key = hex.slice(0, 24).match(/.{4}/g).join("-");
  props_().setProperty("ADMIN_HASH", sha256_(normKey_(key)));
  log_("board password", "new password created", "sheet menu");
  return key;
}

function setSignupCode_(raw) {
  var code = normCode_(raw);
  if (!code) { props_().deleteProperty("JOIN_CODE"); log_("sign-up code", "sign-ups closed", "sheet menu"); return { ok: true, code: "" }; }
  if (code.length < 6 || code.length > 20) return { ok: false, error: "Use 6 to 20 letters or numbers." };
  props_().setProperty("JOIN_CODE", code);
  log_("sign-up code", "code changed", "sheet menu");
  return { ok: true, code: code };
}

// Returns null when the password is right, or the message to show.
function checkBoardPassword_(key) {
  var stored = props_().getProperty("ADMIN_HASH");
  if (!stored) return "No board password yet. In the Sheet: Ledger > New board password.";
  var k = normKey_(key);
  if (k.length !== 24 || !safeEqual_(sha256_(k), stored)) return "That board password is not right.";
  return null;
}

function normKey_(s) { return String(s == null ? "" : s).toLowerCase().replace(/[^0-9a-f]/g, ""); }
function normCode_(s) { return String(s == null ? "" : s).toUpperCase().replace(/[^0-9A-Z]/g, ""); }

function sha256_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ("0" + (b & 0xff).toString(16)).slice(-2); }).join("");
}

// Compares every character so timing does not reveal how much of a guess was right.
function safeEqual_(a, b) {
  a = String(a); b = String(b);
  var diff = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/* ---------- Helpers ---------- */

function readTable_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error("The ledger is not set up yet.");
  var lastRow = sheet.getLastRow(), lastCol = sheet.getLastColumn();
  if (lastRow < 1) throw new Error("The ledger is not set up yet.");

  var header = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  var weeks = header.slice(FIXED.length).map(clean_);
  while (weeks.length && !weeks[weeks.length - 1]) weeks.pop();

  var rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, Math.max(lastCol, FIXED.length)).getValues() : [];
  var players = [];
  rows.forEach(function (r, i) {
    var name = clean_(r[0]);
    if (!name) return; // blank rows are skipped; row keeps each player's real position
    players.push({
      row: i,
      name: name,
      email: clean_(r[1]),
      results: weeks.map(function (_, w) { return num_(r[FIXED.length + w]); })
    });
  });
  return { sheet: sheet, weeks: weeks, players: players, rowCount: rows.length };
}

// Starts with a letter or number; then letters, numbers, spaces, . ' (straight or curly) and hyphens.
// Nothing that could start a spreadsheet formula or carry HTML.
var NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} .'\u2019-]*$/u;

function validName_(raw) {
  var v = clean_(raw);
  if (!v) return { error: "Enter the name you want on the leaderboard." };
  if (v.length > 40) return { error: "Keep the name under 40 characters." };
  if (!NAME_RE.test(v)) {
    return { error: "Use letters, numbers, spaces, periods, apostrophes or hyphens." };
  }
  return { value: v };
}

function cleanBy_(raw) {
  var n = validName_(raw);
  return n.error ? "board (unnamed)" : n.value;
}

function num_(v) {
  if (typeof v === "number") return isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  var t = v.trim().replace(/[\u2212\u2013]/g, "-").replace(/[$,\s+]/g, "");
  var neg = /^\(.*\)$/.test(t);
  if (neg) t = t.slice(1, -1);
  if (!/^-?\d*\.?\d+$/.test(t)) return null;
  return parseFloat(t) * (neg ? -1 : 1);
}

function logSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(LOG_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(LOG_NAME);
    sheet.getRange(1, 1, 1, 4).setValues([["When", "Action", "Detail", "By"]]).setFontWeight("bold");
    sheet.getRange(1, 2, sheet.getMaxRows(), 3).setNumberFormat("@");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function log_(action, detail, by) {
  logSheet_().appendRow([new Date(), action, safe_(String(detail)), safe_(String(by || ""))]);
}

// Approximate per-window counter in the script cache; used to blunt request floods.
function allow_(name, limit, windowSec) {
  var cache = CacheService.getScriptCache();
  var k = "rl:" + name + ":" + Math.floor(Date.now() / 1000 / windowSec);
  var n = (Number(cache.get(k)) || 0) + 1;
  cache.put(k, String(n), windowSec * 2);
  return n <= limit;
}

function props_() { return PropertiesService.getScriptProperties(); }
function clean_(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }
function key_(s) { return clean_(s).toLowerCase(); }
function indexOfKey_(list, s) {
  var k = key_(s);
  for (var i = 0; i < list.length; i++) if (key_(list[i]) === k) return i;
  return -1;
}
// A leading apostrophe stores the text literally, so a value can never become a formula.
function safe_(s) { return /^[=+\-@]/.test(s) ? "'" + s : s; }
function clearCache_() { CacheService.getScriptCache().remove(CACHE_KEY); }

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function json_(obj) {
  return ContentService.createTextOutput(typeof obj === "string" ? obj : JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
