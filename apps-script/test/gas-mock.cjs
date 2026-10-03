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
    setFrozenRows() {} setFrozenColumns() {}
  }
  const sheets = {};
  const ss = { getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = new Sheet(n)), toast() {} };
  const cache = new Map(), props = new Map();
  const ui = { createMenu() { return { addItem() { return this; }, addSeparator() { return this; }, addToUi() {} }; }, alert() {}, prompt() {}, ButtonSet: {}, Button: {} };
  const ctx = {
    console,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, getUi: () => ui },
    CacheService: { getScriptCache: () => ({ get: k => cache.has(k) ? cache.get(k) : null, put: (k, v) => cache.set(k, v), remove: k => cache.delete(k) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props.has(k) ? props.get(k) : null, setProperty: (k, v) => props.set(k, v), deleteProperty: k => props.delete(k) }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      DigestAlgorithm: { SHA_256: "sha256" }, Charset: { UTF_8: "utf8" },
      computeDigest: (alg, s) => Array.from(crypto.createHash(alg).update(s, "utf8").digest()).map(b => b > 127 ? b - 256 : b),
    },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: s => ({ s, setMimeType() { return this; }, getContent() { return s; } }) },
    HtmlService: { createHtmlOutput: () => ({ setWidth() { return this; }, setHeight() { return this; } }) },
  };
  vm.createContext(ctx);
  const codePath = process.env.CODE_GS || path.join(__dirname, "..", "Code.gs");
  vm.runInContext(fs.readFileSync(codePath, "utf8"), ctx, { filename: "Code.gs" });
  ctx.__sheet = () => sheets.Players;
  ctx.__log = () => sheets.Log;
  ctx.__list = () => sheets["Mailing list"];
  ctx.__props = props;
  ctx.__cache = cache;
  return ctx;
}
module.exports = { makeEnv };
