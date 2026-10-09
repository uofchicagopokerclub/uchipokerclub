/** @OnlyCurrentDoc */
/*
  UChicago Poker Club: ledger backend (Google Apps Script, bound to the ledger Google Sheet).

  One-time setup
  1. Create a Google Sheet on the club Google account, and turn on 2-Step Verification for that account.
  2. Extensions > Apps Script. Replace Code.gs with this file. Save.
  3. Reload the Sheet. A "Ledger" menu appears.
       Ledger > Set up sheet             (approve access when asked; run it again after updating this file)
       Ledger > New board password       (shown once: copy it to the board)
       Ledger > Set meeting code         (or change it from the board tool at the meeting)
  4. Apps Script: Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.
     Copy the URL ending in /exec into ledger.apiUrl in content/club.js in the website repo, then commit.
  5. Share the Sheet only with board members who need it, never "Anyone with the link".

  Every meeting: show the meeting code in the room. Members log their chips at www.uchipokerclub.com/ledger/log,
  and a board member checks each stack and approves it at www.uchipokerclub.com/ledger/record (board password).

  Security model
  - Public read: names and results of people who have played. Emails and unapproved results never leave the Sheet.
  - Joining and logging a result need the meeting code (6+ characters). Anonymous traffic is capped per minute, so
    guessing it is impractical. The list of names is shown only to someone with the code.
  - A logged result counts only after a board member approves it. Logging is open on meeting nights only (4 p.m. to
    4 a.m. Chicago, on the date a week column names), with one entry per member per night.
  - Recording, approving and changing the code need the board password: a generated 96-bit secret, stored only as a
    SHA-256 hash. Requests with the right password are never rate limited, so a flood cannot lock the board out.
  - Changing the password needs edit access to this Sheet (your Google login).
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
var SUBMIT_NAME = "Submissions";
var TIME_ZONE = "America/Chicago"; // meeting days are Chicago dates
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
var MAX_SUBMISSIONS = 20000; // logged-result rows (one per member per night, so a term needs a few hundred)
var MAX_LOGS_PER_NIGHT = 5;  // a member can fix a typo, not flood the board's list
var NIGHT_OPENS = 16;        // logging opens at 4 p.m. Chicago on a meeting day...
var NIGHT_CLOSES = 4;        // ...and closes at 4 a.m., for a meeting that runs late
var STARTING_STACK = 7500;   // chips each member starts a meeting with (Max, 2026-10-09; was 10,000)
var MAX_BODY = 100000;       // bytes per request
var MAX_CHIPS = 10000000;    // largest result accepted for one night
var ANON_PER_MINUTE = 300;   // sign-ups plus wrong-password requests, combined

/* ---------- Sheet menu (needs edit access to the Sheet) ---------- */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Ledger")
    .addItem("Set up sheet", "setupSheet")
    .addItem("New board password", "newBoardPasswordPrompt")
    .addItem("Set meeting code", "meetingCodePrompt")
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
  var repaired = repairListRows_();
  sponsorSheet_();
  var submissions = submitSheet_();
  submissions.getRange(1, 3, submissions.getMaxRows(), 2).setNumberFormat("@"); // rows added since creation too
  ss.toast("Ledger sheet is ready." + (repaired ? " Fixed the column order of " + repaired + " mailing list row" + (repaired === 1 ? "." : "s.") : ""), "Ledger");
}

function newBoardPasswordPrompt() {
  var ui = SpreadsheetApp.getUi();
  if (prop_("ADMIN_HASH")) {
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

function meetingCodePrompt() {
  var ui = SpreadsheetApp.getUi();
  var current = prop_("JOIN_CODE");
  var res = ui.prompt("Meeting code",
    (current ? "Current code: " + current + "\n\n" : "Joining and logging results are closed until a code is set.\n\n") +
    "New code, 6 to 20 letters or numbers. Leave blank to close joining and logging.", ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var out = setMeetingCode_(res.getResponseText(), "sheet menu");
  ui.alert(out.ok ? (out.code ? "The meeting code is now " + out.code + "." : "Joining and logging are closed.") : out.error);
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

// POST /exec: the site's forms and the board tool. Body is a JSON string sent as text/plain (no preflight).
function doPost(e) {
  var raw = (e && e.postData && e.postData.contents) || "";
  if (raw.length > MAX_BODY) return json_({ ok: false, error: "Request too large." });
  var busy = { ok: false, error: BUSY };

  var data;
  try { data = JSON.parse(raw || "{}"); } catch (err) { data = null; }
  if (!data || typeof data !== "object" || Array.isArray(data)) return json_({ ok: false, error: "Something went wrong. Try again." });

  try {
    var action = data.action || "join";
    // Only unauthenticated traffic is throttled: a flood can slow sign-ups but never blocks the board. Every
    // action that checks the meeting code goes through here, which is what makes guessing the code impractical.
    var throttled = function (fn) { return json_(allow_("anon", ANON_PER_MINUTE, 60) ? fn(data) : busy); };
    if (action === "join") return throttled(join_);
    if (action === "roster") return throttled(roster_);
    if (action === "submit") return throttled(submit_);
    if (action === "subscribe") return throttled(subscribe_);
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
    if (action === "review") return json_(review_(data.id, data.decision, data.chips, by));
    if (action === "setCode") return json_(setMeetingCode_(data.code, by));
    return json_({ ok: false, error: "Unknown action." });
  } catch (err) {
    return json_({ ok: false, error: err && err.message ? err.message : "Something went wrong. Try again." });
  }
}

/* ---------- Join ---------- */

// The meeting code gates joining and logging. It is checked before anything else, so a caller without it
// learns nothing about the form or the list of names. Returns null when the code is right.
function checkCode_(raw, closedMessage) {
  var code = prop_("JOIN_CODE");
  if (!code) return { ok: false, error: closedMessage };
  if (!safeEqual_(normCode_(raw), code)) {
    return { ok: false, field: "code", error: "That meeting code is not right. The board shows it at meetings." };
  }
  return null;
}

function join_(data) {
  if (data.website) return { ok: true, name: "" }; // honeypot: bots fill hidden fields
  var denied = checkCode_(data.code, "Sign-ups are closed right now. Ask a board member.");
  if (denied) return denied;

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
    var same = t.players.filter(function (p) { return p.email && p.email.toLowerCase() === email; })[0];
    if (same) {
      // The same sign-up again, usually a member trying again after a slow answer that did go through.
      if (key_(same.name) === key_(n.value)) return { ok: true, name: same.name };
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
    clearNight_(); // someone joining at the meeting can log a minute later
    log_("join", n.value, "sign-up form");
    return { ok: true, name: n.value };
  });
}

/* ---------- Members log their results (meeting code, meeting nights only) ---------- */

var LOG_CLOSED = "Logging is closed right now. Ask a board member.";
var NOT_TONIGHT = "Results can only be logged on a meeting night.";
var CHIPS_HINT = "Enter the number of chips in front of you.";

// Step one of the log form: the meeting code unlocks tonight's week and the list of names.
function roster_(data) {
  var denied = checkCode_(data.code, LOG_CLOSED);
  if (denied) return denied;
  var night = night_();
  if (!night.week) return { ok: false, error: NOT_TONIGHT };
  return { ok: true, week: night.week, startingStack: loggingStack_(), names: night.names };
}

// Step two: a member logs their end-of-night chip count. Each member has one row per night in the Submissions tab;
// logging again before it is approved updates that row and keeps the number it replaced, so the board can see a
// change. Nothing counts until a board member has seen the chips and approved it.
function submit_(data) {
  var denied = checkCode_(data.code, LOG_CLOSED);
  if (denied) return denied;
  var chips = wholeChips_(data.chips);
  if (chips === null) return { ok: false, field: "chips", error: CHIPS_HINT };
  var night = night_();
  if (!night.week) return { ok: false, error: NOT_TONIGHT };
  var n = indexOfKey_(night.names, data.name);
  if (n < 0) return { ok: false, field: "name", error: "Pick your name from the list." };
  var name = night.names[n], week = night.week, start = loggingStack_();

  return withLock_(function () {
    // Read fresh under the lock: a board member may have just approved this night or typed it in.
    var t = readTable_();
    var w = indexOfKey_(t.weeks, week), i = indexOfKey_(t.players.map(function (p) { return p.name; }), name);
    if (w < 0 || i < 0) return { ok: false, error: LOG_CLOSED };
    if (t.players[i].results[w] !== null) {
      return { ok: false, error: "Your " + week + " result is already on the ledger. Ask a board member to change it." };
    }
    var s = readSubmissions_(true), mine = null;
    s.rows.forEach(function (r) {
      if (r.status === "pending" && key_(r.week) === key_(week) && key_(r.name) === key_(name)) mine = r;
    });
    if (mine && mine.chips === chips && mine.stack === start) {
      // The same count again, usually a member trying again after a slow answer that did go through. Nothing
      // changes, so it neither uses up a log nor shows the board a change that did not happen.
      return { ok: true, name: name, week: week, result: chips - start, replaced: false };
    }
    if (mine && mine.times >= MAX_LOGS_PER_NIGHT) {
      return { ok: false, error: "You have logged " + week + " " + mine.times + " times. Show your chips to a board member." };
    }
    if (mine) {
      s.sheet.getRange(mine.row + 2, 2, 1, 9).setValues([[new Date(), safe_(week), safe_(name), chips, start,
        chips - start, "pending", mine.times + 1, mine.chips]]);
    } else {
      if (s.rows.length >= MAX_SUBMISSIONS) return { ok: false, error: "The results log is full. Ask a board member." };
      s.sheet.appendRow([Utilities.getUuid(), new Date(), safe_(week), safe_(name), chips, start, chips - start,
        "pending", 1, "", "", "", ""]);
    }
    return { ok: true, name: name, week: week, result: chips - start, replaced: Boolean(mine) };
  });
}

// Members always log chip counts, so they need a stack even after the board has saved a week in profit-or-loss
// mode, which stores 0.
function loggingStack_() { return startingStack_() || STARTING_STACK; }

// A whole number of chips from 0 to MAX_CHIPS, or null.
function wholeChips_(v) {
  var n = num_(v);
  return n === null || n < 0 || n > MAX_CHIPS || Math.floor(n) !== n ? null : n;
}

// Tonight's week and the names on the ledger, cached for a minute because every phone in the room asks at once.
// join_, addPlayer_ and addWeek_ clear it.
function night_() {
  var cache = CacheService.getScriptCache(), k = "night:" + nightDate_();
  var hit = cache.get(k);
  if (hit) return JSON.parse(hit);
  var t = readTable_(), w = tonight_(t.weeks);
  var night = {
    week: w >= 0 ? t.weeks[w] : "",
    names: t.players.map(function (p) { return p.name; })
      .sort(function (a, b) { return a.toLowerCase().localeCompare(b.toLowerCase()); })
  };
  cache.put(k, JSON.stringify(night), 60);
  return night;
}
function clearNight_() { CacheService.getScriptCache().remove("night:" + nightDate_()); }

// Columns: 1 ID, 2 Logged, 3 Week, 4 Name, 5 Chips, 6 Stack, 7 Result, 8 Status, 9 Times, 10 Earlier chips,
// 11 Counted, 12 Reviewed by, 13 Reviewed at.
var SUBMIT_HEADER = ["ID", "Logged", "Week", "Name", "Chips", "Stack", "Result", "Status", "Times", "Earlier chips",
  "Counted", "Reviewed by", "Reviewed at"];

function submitSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SUBMIT_NAME);
  if (sheet) return sheet;
  try {
    sheet = ss.insertSheet(SUBMIT_NAME);
  } catch (err) {
    // Another request created it a moment ago.
    sheet = ss.getSheetByName(SUBMIT_NAME);
    if (!sheet) throw err;
    return sheet;
  }
  sheet.getRange(1, 1, 1, SUBMIT_HEADER.length).setValues([SUBMIT_HEADER]).setFontWeight("bold");
  sheet.getRange(1, 3, sheet.getMaxRows(), 2).setNumberFormat("@"); // week and name stay literal text
  sheet.setFrozenRows(1);
  return sheet;
}

// create: false for read-only callers, which see no rows until the tab exists.
function readSubmissions_(create) {
  var sheet = create ? submitSheet_() : SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SUBMIT_NAME);
  if (!sheet) return { sheet: null, rows: [] };
  var n = sheet.getLastRow() - 1;
  var values = n > 0 ? sheet.getRange(2, 1, n, SUBMIT_HEADER.length).getValues() : [];
  return {
    sheet: sheet,
    rows: values.map(function (r, i) {
      return { row: i, id: String(r[0]), at: r[1], week: weekText_(r[2]), name: clean_(r[3]), chips: num_(r[4]),
        stack: num_(r[5]), result: num_(r[6]), status: clean_(r[7]), times: num_(r[8]) || 1, earlier: num_(r[9]) };
    })
  };
}

// Sheets can turn "Oct 16" typed into a cell without text format into a date; read it back as the label.
function weekText_(v) { return isDate_(v) ? Utilities.formatDate(v, TIME_ZONE, "MMM d") : clean_(v); }
function isDate_(v) { return Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime()); }

// The Chicago date of the meeting night under way at `now` (default: this moment), or "" outside meeting-night
// hours (NIGHT_OPENS until NIGHT_CLOSES the next morning). The tests replace this to pretend a meeting is on.
function nightDate_(now) {
  now = now || new Date();
  var hour = Number(Utilities.formatDate(now, TIME_ZONE, "H"));
  if (hour < NIGHT_OPENS && hour >= NIGHT_CLOSES) return "";
  return Utilities.formatDate(new Date(now.getTime() - NIGHT_CLOSES * 3600000), TIME_ZONE, "yyyy-MM-dd");
}

var MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// A week column label ("Oct 9") plus the year in TERM -> "2026-10-09", or "" for a label that is not a date.
// Ledger > Add a week refuses labels this cannot read, so every week can open for logging.
function weekDate_(label) {
  var m = /^([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{1,2})$/.exec(clean_(label));
  var y = /(\d{4})\s*$/.exec(TERM);
  if (!m || !y) return "";
  var month = MONTHS.indexOf(m[1].toLowerCase()) + 1, day = Number(m[2]);
  if (!month || day < 1 || day > 31) return "";
  return y[1] + "-" + (month < 10 ? "0" : "") + month + "-" + (day < 10 ? "0" : "") + day;
}

// Index of the week being played tonight, or -1 outside a meeting night.
function tonight_(weeks) {
  var night = nightDate_();
  if (!night) return -1;
  for (var w = 0; w < weeks.length; w++) if (weekDate_(weeks[w]) === night) return w;
  return -1;
}

/* ---------- Mailing list ---------- */

// Footer form on every page: First Name, Last Name, Email Address, Class Year, Major. Any email domain. Stored as
// LIST_HEADER below. A repeat sign-up answers exactly like a new one, so the form never reveals who is on the list.
function subscribe_(data) {
  if (data.website) return { ok: true }; // honeypot
  var first = validPersonName_(data.fname, 30);
  if (first.error) return { ok: false, field: "fname", error: first.error };
  var last = validPersonName_(data.lname, 30);
  if (last.error) return { ok: false, field: "lname", error: last.error };
  var email = clean_(data.email).toLowerCase();
  var emailOk = /^[a-z0-9][a-z0-9._%+-]*@[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(email) && email.length <= 120;
  if (!emailOk) return { ok: false, field: "email", error: "Enter a valid email address." };
  // Class years only: the mailing list has no "Other", unlike the ledger sign-up. A page loaded before these fields
  // existed (2026-10-07) sends neither; its sign-up is saved with both blank rather than failing with no visible error.
  var year = clean_(data.year), major = clean_(data.major);
  if (data.year !== undefined || data.major !== undefined) {
    if (year === "Other" || YEARS.indexOf(year) < 0) return { ok: false, field: "year", error: "Pick your class year." };
    if (!major) return { ok: false, field: "major", error: "Enter your major. Undeclared is fine." };
    if (major.length > 60 || !COMPANY_RE.test(major)) { // the same characters a company name allows
      return { ok: false, field: "major", error: "Use letters, spaces and basic punctuation, up to 60 characters." };
    }
  }

  return withLock_(function () {
    var sheet = listSheet_(), col = listColumns_(sheet);
    var rows = sheet.getLastRow() - 1;
    var emails = rows > 0 ? sheet.getRange(2, col[0] + 1, rows, 1).getValues() : [];
    if (emails.some(function (r) { return clean_(r[0]).toLowerCase() === email; })) return { ok: true };
    if (rows >= MAX_SUBSCRIBERS) return { ok: false, error: "The mailing list is full. Email the club instead." };
    sheet.appendRow(listRow_(col, [safe_(email), safe_(first.value), safe_(last.value), new Date(), "website", year,
      safe_(major)]));
    return { ok: true };
  });
}

// The Mailing list tab's fields, in the order a new tab gets them. The board can reorder the columns in the Sheet:
// the form reads the header row to find each one, so a sign-up never lands in the wrong column. Fields added later
// (Class Year and Major, 2026-10-07) go at the end, so LIST_LEGACY's positions still line up with the first five.
var LIST_HEADER = ["Email", "First Name", "Last Name", "Joined", "Source", "Class Year", "Major"];
// Before 2026-10-06 the form wrote First Name, Last Name, Email, Joined, Source whatever the header said.
var LIST_LEGACY = [2, 0, 1, 3, 4]; // where each LIST_HEADER field sat in that old order

// Column index (0-based) of each LIST_HEADER field, by header name. A field the header row lacks (the tab predates
// it) gets a new column after every column in use, header included, so it never lands on someone's data.
function listColumns_(sheet) {
  var width = sheet.getLastColumn();
  var header = width ? sheet.getRange(1, 1, 1, width).getDisplayValues()[0].map(key_) : [];
  return LIST_HEADER.map(function (h) {
    var at = header.indexOf(key_(h));
    if (at < 0) {
      at = header.length;
      header.push(key_(h));
      sheet.getRange(1, at + 1).setValue(h).setFontWeight("bold");
    }
    return at;
  });
}

// values in LIST_HEADER order -> a row with each value in its column.
function listRow_(col, values) {
  var row = [];
  values.forEach(function (v, i) { row[col[i]] = v; });
  for (var j = 0; j < row.length; j++) if (row[j] === undefined) row[j] = "";
  return row;
}

// Puts back rows the form wrote in the old fixed order after the board had moved the Email column: the email sits
// where the old order put it, and the current Email column holds no address. Run from Set up sheet; a no-op once fixed.
function repairListRows_() {
  var sheet = listSheet_(), col = listColumns_(sheet), rows = sheet.getLastRow() - 1;
  if (rows < 1 || col[0] === LIST_LEGACY[0]) return 0;
  var width = Math.max(sheet.getLastColumn(), LIST_HEADER.length);
  var range = sheet.getRange(2, 1, rows, width), values = range.getValues(), fixed = 0;
  values.forEach(function (r) {
    if (String(r[col[0]]).indexOf("@") >= 0 || String(r[LIST_LEGACY[0]]).indexOf("@") < 0) return;
    var old = LIST_LEGACY.map(function (at) { return r[at]; });
    old.forEach(function (v, i) { r[col[i]] = v; });
    fixed++;
  });
  if (fixed) range.setValues(values);
  return fixed;
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
    sheet.getRange(1, 1, 1, LIST_HEADER.length).setValues([LIST_HEADER]).setFontWeight("bold");
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
  var tonight = tonight_(t.weeks);
  var subs = boardSubmissions_(t.weeks);
  var waiting = -1;
  subs.pending.forEach(function (s) { waiting = Math.max(waiting, indexOfKey_(t.weeks, s.week)); });
  var firstEmpty = -1;
  for (var w = 0; w < t.weeks.length && firstEmpty < 0; w++) {
    if (!t.players.some(function (p) { return p.results[w] !== null; })) firstEmpty = w;
  }
  // Tonight during a meeting; then the latest week with entries still waiting; then the first week with no results.
  var open = tonight >= 0 ? tonight : waiting >= 0 ? waiting : firstEmpty >= 0 ? firstEmpty : t.weeks.length - 1;
  return {
    term: TERM,
    weeks: t.weeks,
    defaultWeek: t.weeks[open] || "",
    tonight: tonight >= 0 ? t.weeks[tonight] : "",
    // A saved 0 means "type profit or loss directly", so only a missing value falls back to the default.
    startingStack: startingStack_(),
    meetingCode: prop_("JOIN_CODE") || "",
    players: t.players.map(function (p) { return { name: p.name, results: p.results }; }), // never emails
    submissions: subs.pending,
    handled: subs.handled
  };
}

// What the board tool needs from the Submissions tab: every entry still waiting this term (newest first), and how
// many were already approved or rejected per week. A problem with the tab never keeps the board out of the tool.
function boardSubmissions_(weeks) {
  var out = { pending: [], handled: {} };
  try {
    readSubmissions_(false).rows.forEach(function (r) {
      var w = indexOfKey_(weeks, r.week);
      if (w < 0) return;
      if (r.status !== "pending") { out.handled[weeks[w]] = (out.handled[weeks[w]] || 0) + 1; return; }
      out.pending.push({ id: r.id, week: weeks[w], name: r.name, chips: r.chips, stack: r.stack, result: r.result,
        times: r.times, earlier: r.earlier, at: isDate_(r.at) ? r.at.toISOString() : String(r.at) });
    });
  } catch (err) {
    return out;
  }
  out.pending.reverse();
  return out;
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
    setProp_("startingStack", String(start));
    clearCache_();
    log_("results", t.weeks[w] + ": " + saved + " saved, " + cleared + " cleared", by);
    return { ok: true, saved: saved, cleared: cleared, missing: missing, week: t.weeks[w] };
  });
}

// A board member has seen the chips. Approve writes counted chips minus the stack the entry was logged against into
// the Players tab; reject writes nothing, and the member can log again. Either way the member's own number stays on
// the row, so what was claimed and what was counted can both be checked later.
function review_(id, decision, counted, by) {
  if (decision !== "approve" && decision !== "reject") throw new Error("Choose approve or reject.");
  var chips = decision === "approve" ? wholeChips_(counted) : null;
  if (decision === "approve" && chips === null) {
    throw new Error("Enter the chips you counted, a whole number up to " + MAX_CHIPS + ".");
  }
  var done = withLock_(function () {
    var s = readSubmissions_(false), r = null;
    for (var i = 0; i < s.rows.length && !r; i++) if (s.rows[i].id === String(id)) r = s.rows[i];
    if (!r) return { ok: false, error: "That entry is no longer there. Refresh the list." };
    if (r.status !== "pending") return { ok: false, error: r.name + "’s entry was already " + (r.status || "handled") + "." };
    var keep = [r.times, r.earlier === null ? "" : r.earlier];

    if (decision === "reject") {
      s.sheet.getRange(r.row + 2, 8, 1, 6).setValues([["rejected"].concat(keep, ["", safe_(by), new Date()])]);
      return { ok: true, decision: "reject", name: r.name, week: r.week, log: r.week + ": " + r.name };
    }

    var t = readTable_();
    var w = indexOfKey_(t.weeks, r.week), p = indexOfKey_(t.players.map(function (x) { return x.name; }), r.name);
    if (w < 0 || p < 0) return { ok: false, error: r.name + " is no longer on the ledger for " + r.week + "." };
    if (t.players[p].results[w] !== null) {
      return { ok: false, error: r.name + " already has a result for " + r.week + ". Reject this entry, or change the number in the table." };
    }
    var result = chips - (r.stack || STARTING_STACK);
    t.sheet.getRange(t.players[p].row + 2, FIXED.length + w + 1).setValue(result);
    s.sheet.getRange(r.row + 2, 7, 1, 7).setValues([[result, "approved"].concat(keep, [chips, safe_(by), new Date()])]);
    clearCache_();
    return { ok: true, decision: "approve", name: r.name, week: r.week, result: result,
      log: r.week + ": " + r.name + ", counted " + chips + " (logged " + r.chips + ")" };
  });
  // Logged after the lock is released, so the audit trail never makes the next member wait.
  if (done.ok) log_(done.decision === "approve" ? "approved result" : "rejected result", done.log, by);
  delete done.log;
  return done;
}

function startingStack_() {
  var saved = prop_("startingStack");
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
    clearNight_();
    log_("add player", n.value, by);
    return { ok: true, name: n.value };
  });
}

function addWeek_(label) {
  label = clean_(label);
  if (!label || label.length > 20) return { ok: false, error: "Enter a label for the week, up to 20 characters." };
  // Members can log only on the night a week's label names, so it has to be a date this file can read.
  if (!weekDate_(label)) return { ok: false, error: "Use the meeting date as the label, like Jan 8, so members can log that night." };
  return withLock_(function () {
    var t = readTable_();
    if (indexOfKey_(t.weeks, label) >= 0) return { ok: false, error: "There is already a week called " + label + "." };
    t.sheet.getRange(1, FIXED.length + t.weeks.length + 1).setNumberFormat("@").setValue(safe_(label)).setFontWeight("bold");
    clearCache_();
    clearNight_();
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
  setProp_("ADMIN_HASH", sha256_(normKey_(key)));
  log_("board password", "new password created", "sheet menu");
  return key;
}

// One code for joining and for logging results. Stored as JOIN_CODE, its name from before logging existed, so a
// code set earlier keeps working. Blank closes both.
function setMeetingCode_(raw, by) {
  var code = normCode_(raw);
  if (!code) { setProp_("JOIN_CODE", null); log_("meeting code", "joining and logging closed", by); return { ok: true, code: "" }; }
  if (code.length < 6 || code.length > 20) return { ok: false, error: "Use 6 to 20 letters or numbers." };
  setProp_("JOIN_CODE", code);
  log_("meeting code", "code changed", by);
  return { ok: true, code: code };
}

// Returns null when the password is right, or the message to show.
function checkBoardPassword_(key) {
  var stored = prop_("ADMIN_HASH");
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

// Settings read on every request (the meeting code, the board password hash, the starting stack) go through the
// script cache: the daily Properties quota is small, and a flood of requests must not be able to spend it.
var NO_VALUE = "\u0000none";
function prop_(k) {
  var cache = CacheService.getScriptCache(), hit = cache.get("prop:" + k);
  if (hit !== null) return hit === NO_VALUE ? null : hit;
  var v = props_().getProperty(k);
  cache.put("prop:" + k, v === null ? NO_VALUE : v, 600);
  return v;
}
// value null deletes the setting.
function setProp_(k, value) {
  if (value === null) props_().deleteProperty(k); else props_().setProperty(k, value);
  CacheService.getScriptCache().put("prop:" + k, value === null ? NO_VALUE : value, 600);
}

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

var BUSY = "The ledger is busy. Try again in a minute.";

// flush() before release: Sheets batches writes, and the next request to take the lock must read them. A request
// that waits 30 seconds for the lock answers with BUSY rather than Google's own lock-timeout text.
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error(BUSY);
  try { return fn(); } finally { SpreadsheetApp.flush(); lock.releaseLock(); }
}

function json_(obj) {
  return ContentService.createTextOutput(typeof obj === "string" ? obj : JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
