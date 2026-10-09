// Minimal in-memory stand-ins for the Google services Code.gs uses, so the backend runs under Node.
const fs = require("fs"), vm = require("vm"), crypto = require("crypto"), path = require("path");

function makeEnv() {
  const fmtDate = d => d.toISOString().slice(0, 16).replace("T", " ");
  class Range {
    constructor(sh, r, c, nr = 1, nc = 1) { Object.assign(this, { sh, r, c, nr, nc }); }
    getValues() { const o = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) { const v = (this.sh.g[this.r - 1 + i] || [])[this.c - 1 + j]; row.push(v === undefined ? "" : v); } o.push(row); } return o; }
    getDisplayValues() { return this.getValues().map(r => r.map(v => v instanceof Date ? fmtDate(v) : String(v))); }
    setValues(vals) { if (vals.length !== this.nr || vals[0].length !== this.nc) throw new Error(`setValues dims ${vals.length}x${vals[0].length} != ${this.nr}x${this.nc}`); vals.forEach((row, i) => row.forEach((v, j) => this.sh.set(this.r + i, this.c + j, v))); return this; }
    setValue(v) { this.sh.set(this.r, this.c, v); return this; }
    setNumberFormat() { return this; } setFontWeight() { return this; }
  }
  class Sheet {
    constructor(name) { this.name = name; this.g = []; }
    set(r, c, v) { if (typeof v === "string" && v.startsWith("'")) v = v.slice(1); (this.g[r - 1] ||= [])[c - 1] = v; }
    getRange(r, c, nr, nc) { if (nr === 0 || nc === 0) throw new Error("The number of rows in the range must be at least 1."); return new Range(this, r, c, nr, nc); }
    getLastRow() { let l = 0; this.g.forEach((row, i) => { if (row && row.some(v => v !== "" && v !== undefined)) l = i + 1; }); return l; }
    getLastColumn() { let l = 0; this.g.forEach(row => (row || []).forEach((v, j) => { if (v !== "" && v !== undefined) l = Math.max(l, j + 1); })); return l; }
    getMaxRows() { return 1000; }
    appendRow(a) { const r = this.getLastRow() + 1; a.forEach((v, j) => this.set(r, j + 1, v)); return this; }
    insertColumnAfter(c) { this.g.forEach((row) => { if (row && row.length > c) row.splice(c, 0, ""); }); }
    setFrozenRows() {} setFrozenColumns() {}
  }
  const sheets = {};
  // Like Apps Script, inserting a tab whose name is taken throws.
  const ss = {
    getSheetByName: n => sheets[n] || null,
    insertSheet: n => { if (sheets[n]) throw new Error(`A sheet with the name "${n}" already exists.`); return (sheets[n] = new Sheet(n)); },
    toast() {},
  };
  const cache = new Map(), props = new Map();
  const ui = { createMenu() { return { addItem() { return this; }, addSeparator() { return this; }, addToUi() {} }; }, alert() {}, prompt() {}, ButtonSet: {}, Button: {} };
  const ctx = {
    console,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, getUi: () => ui, flush() {} },
    CacheService: { getScriptCache: () => ({ get: k => cache.has(k) ? cache.get(k) : null, put: (k, v) => cache.set(k, v), remove: k => cache.delete(k) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock: () => !ctx.__lockBusy, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props.has(k) ? props.get(k) : null, setProperty: (k, v) => props.set(k, v), deleteProperty: k => props.delete(k) }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      DigestAlgorithm: { SHA_256: "sha256" }, Charset: { UTF_8: "utf8" },
      computeDigest: (alg, s) => Array.from(crypto.createHash(alg).update(s, "utf8").digest()).map(b => b > 127 ? b - 256 : b),
      formatDate: (d, tz, fmt) => {
        if (fmt === "yyyy-MM-dd") return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
        if (fmt === "H") return String(Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(d)));
        if (fmt === "MMM d") return new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "numeric" }).format(d);
        throw new Error("mock formatDate does not support " + fmt);
      },
    },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: s => ({ s, setMimeType() { return this; }, getContent() { return s; } }) },
    HtmlService: { createHtmlOutput: () => ({ setWidth() { return this; }, setHeight() { return this; } }) },
    MailApp: { sendEmail(msg) { if (ctx.__mailFails) throw new Error("Service invoked too many times"); ctx.__sent.push(msg); } },
  };
  vm.createContext(ctx);
  const codePath = process.env.CODE_GS || path.join(__dirname, "..", "Code.gs");
  vm.runInContext(fs.readFileSync(codePath, "utf8"), ctx, { filename: "Code.gs" });
  ctx.__sheet = () => sheets.Players;
  ctx.__log = () => sheets.Log;
  ctx.__list = () => sheets["Mailing list"];
  ctx.__sponsors = () => sheets["Sponsor inquiries"];
  ctx.__submissions = () => sheets.Submissions;
  ctx.__sent = [];
  ctx.__mailFails = false;
  ctx.__lockBusy = false; // true: every tryLock times out, as when a long queue is waiting for the lock
  ctx.__props = props;
  ctx.__cache = cache;
  return ctx;
}
module.exports = { makeEnv };
