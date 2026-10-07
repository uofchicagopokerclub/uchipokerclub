const assert = require("assert");
const { makeEnv } = require("./gas-mock.cjs");
const eq = (a, b) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b));
const G = makeEnv();
const post = b => JSON.parse(G.doPost({ postData: { contents: typeof b === "string" ? b : JSON.stringify(b) } }).getContent());
const get = () => JSON.parse(G.doGet().getContent());
let n = 0; const ok = (name, fn) => { fn(); n++; console.log("  pass", name); };
let KEY, CODE;
const join = (o) => post(Object.assign({ code: CODE }, o));
const admin = (action, o) => post(Object.assign({ action, key: KEY, by: "Max L." }, o));

ok("setup creates an empty ledger and a Log tab", () => {
  G.setupSheet();
  const d = get();
  eq(d.weeks, ["Oct 9","Oct 16","Oct 23","Oct 30","Nov 6","Nov 13","Nov 20"]);
  assert.strictEqual(d.players.length, 0);
  assert.ok(G.__log());
});

console.log(" sign-ups");
ok("closed until a meeting code exists (fail closed)", () => assert.match(post({ name: "A", email: "a@uchicago.edu", year: "2028" }).error, /closed/));
ok("meeting code set and normalized", () => { const r = G.setMeetingCode_(" poker-26 ", "sheet menu"); CODE = r.code; assert.strictEqual(CODE, "POKER26"); });
ok("code shorter than 6 rejected", () => assert.strictEqual(G.setMeetingCode_("ABCDE", "sheet menu").ok, false));
ok("wrong code rejected before any field feedback", () => {
  const r = post({ code: "nope", name: "<script>", email: "x", year: "x" });
  assert.strictEqual(r.field, "code");
});
ok("code is case-insensitive", () => assert.strictEqual(join({ code: "poker26", name: "Jamie K.", email: "jamie@uchicago.edu", year: "2029" }).ok, true));
ok("duplicate email rejected", () => assert.strictEqual(join({ name: "Other", email: "JAMIE@uchicago.edu", year: "2029" }).field, "email"));
ok("the same sign-up sent again (a retry after a slow answer) succeeds and adds no row", () => {
  const rows = G.__sheet().getLastRow();
  const r = join({ name: "jamie k.", email: "Jamie@uchicago.edu", year: "2029" });
  eq([r.ok, r.name], [true, "Jamie K."]);
  eq(G.__sheet().getLastRow(), rows);
});
ok("duplicate name rejected", () => assert.strictEqual(join({ name: "jamie k.", email: "j2@uchicago.edu", year: "2029" }).field, "name"));
ok("non-uchicago email rejected", () => assert.strictEqual(join({ name: "Zed", email: "zed@gmail.com", year: "2029" }).field, "email"));
ok("formula and HTML names rejected", () => {
  assert.strictEqual(join({ name: '=IMPORTXML("http://x",B2)', email: "a@uchicago.edu", year: "2028" }).field, "name");
  assert.strictEqual(join({ name: "<img src=x onerror=alert(1)>", email: "a@uchicago.edu", year: "2028" }).field, "name");
});
ok("formula email rejected", () => assert.strictEqual(join({ name: "Ann", email: "=1+1@uchicago.edu", year: "2028" }).field, "email"));
ok("honeypot writes nothing", () => {
  const before = G.__sheet().getLastRow();
  assert.strictEqual(join({ name: "Bot", email: "bot@uchicago.edu", year: "2028", website: "x" }).ok, true);
  assert.strictEqual(G.__sheet().getLastRow(), before);
});
ok("wrong codes do not lock out a member with the right code", () => {
  for (let i = 0; i < 40; i++) post({ code: "WRONG" + i, name: "X", email: "x@uchicago.edu", year: "2028" });
  assert.strictEqual(join({ name: "Late", email: "late@uchicago.edu", year: "2028" }).ok, true);
});
ok("oversized and malformed bodies rejected", () => {
  assert.match(post("x".repeat(100001)).error, /too large/);
  assert.strictEqual(post("not json").ok, false);
  assert.strictEqual(post("[1,2]").ok, false);
});
ok("signed-up players stay private until they have a result", () => assert.strictEqual(get().players.length, 0));

console.log(" board password");
ok("board actions refused before a password exists", () => { const r = post({ action: "load", key: "x" }); assert.ok(r.auth); assert.match(r.error, /No board password/); });
ok("generated password is 96-bit hex, stored only as a hash", () => {
  KEY = G.createBoardPassword_();
  assert.match(KEY, /^[0-9a-f]{4}(-[0-9a-f]{4}){5}$/);
  const stored = G.__props.get("ADMIN_HASH");
  assert.match(stored, /^[0-9a-f]{64}$/);
  assert.ok(![...G.__props.values()].some(v => String(v).includes(KEY.replace(/-/g, ""))));
});
ok("two generated passwords differ", () => { const a = KEY; const b = G.createBoardPassword_(); assert.notStrictEqual(a, b); KEY = b; });
ok("old password stops working after rotation", () => {
  const old = G.createBoardPassword_(); const fresh = G.createBoardPassword_();
  assert.ok(post({ action: "load", key: old }).auth);
  KEY = fresh;
});
ok("wrong, empty, missing and non-string keys refused", () => {
  for (const key of ["", "0000-0000-0000-0000-0000-0000", undefined, null, 12345, { a: 1 }, ["x"], KEY.slice(0, -1)]) {
    const r = post({ action: "save", key, week: "Oct 9", entries: [] });
    assert.ok(r.auth, "accepted " + JSON.stringify(key));
  }
});
ok("password accepted with spaces, caps and no dashes", () => assert.strictEqual(post({ action: "load", key: " " + KEY.toUpperCase().replace(/-/g, " ") + " " }).ok, true));
ok("unknown action refused even with the password", () => assert.match(admin("deleteEverything").error, /Unknown/));
ok("admin load never includes emails", () => assert.ok(!JSON.stringify(admin("load")).includes("@")));

console.log(" recording");
ok("add player works, blocks duplicates and bad names", () => {
  assert.strictEqual(admin("addPlayer", { name: "Walk In" }).ok, true);
  assert.strictEqual(admin("addPlayer", { name: "walk in" }).ok, false);
  assert.strictEqual(admin("addPlayer", { name: "=HYPERLINK(1)" }).ok, false);
});
ok("a sign-up claims the board-added row with the same name", () => {
  admin("addPlayer", { name: "Robin S." });
  const before = G.__sheet().getLastRow();
  const r = join({ name: "robin s.", email: "robin@uchicago.edu", year: "2030" });
  eq([r.ok, r.name], [true, "Robin S."]);
  assert.strictEqual(G.__sheet().getLastRow(), before);
  const row = G.__sheet().g.find(x => x && x[0] === "Robin S.");
  eq([row[1], row[2], row[4]], ["robin@uchicago.edu", "2030", "board"]);
  assert.strictEqual(join({ name: "Robin S.", email: "robin2@uchicago.edu", year: "2030" }).field, "name");
});
ok("save with starting stack stores count minus stack", () => {
  const r = admin("save", { week: "oct 9", entries: [{ name: "jamie k.", value: 12500 }, { name: "Walk In", value: 7500 }, { name: "Ghost", value: 1 }], startingStack: 10000 });
  eq([r.ok, r.saved, r.missing], [true, 2, ["Ghost"]]);
  const p = get().players; eq(p.map(x => [x.name, x.results[0]]), [["Jamie K.", 2500], ["Walk In", -2500]]);
});
ok("strings, huge numbers and negative counts refused", () => {
  assert.match(admin("save", { week: "Oct 16", entries: [{ name: "Walk In", value: "=1+1" }] }).error, /valid number/);
  assert.match(admin("save", { week: "Oct 16", entries: [{ name: "Walk In", value: 1e12 }] }).error, /valid number/);
  assert.match(admin("save", { week: "Oct 16", entries: [{ name: "Walk In", value: -5 }], startingStack: 10000 }).error, /negative/);
  assert.match(admin("save", { week: "Oct 16", entries: "nope" }).error, /Nothing to save/);
  assert.match(admin("save", { week: "Oct 16", entries: [null] }).error, /Bad entry/);
  assert.match(admin("save", { week: "Oct 99", entries: [] }).error, /No week/);
});
ok("a refused save writes nothing, not even the starting stack", () => {
  assert.strictEqual(get().players.find(p => p.name === "Walk In").results[1], null);
  admin("save", { week: "Oct 16", entries: [{ name: "Walk In", value: "bad" }], startingStack: 5000 });
  assert.strictEqual(G.getAdminData_().startingStack, 10000);
});
ok("public feed: names and numbers only", () => {
  const d = get();
  assert.ok(!JSON.stringify(d).includes("@"));
  eq(Object.keys(d.players[0]).sort(), ["name", "results"]);
});
ok("clearing a result empties the cell", () => {
  admin("save", { week: "Oct 9", entries: [{ name: "Walk In", value: null }] });
  assert.strictEqual(get().players.some(p => p.name === "Walk In"), false);
});
ok("blank row between players does not shift writes", () => {
  const sh = G.__sheet(); sh.g.splice(2, 0, []);
  admin("save", { week: "Oct 23", entries: [{ name: "Walk In", value: 900 }] });
  const r = sh.g.findIndex(x => x && x[0] === "Walk In");
  assert.strictEqual(sh.g[r][7], 900);
});
ok("every write is in the Log tab with who did it", () => {
  const rows = G.__log().g.slice(1).map(r => r.slice(1).join(" | "));
  assert.ok(rows.some(r => r.startsWith("results | Oct 9: 2 saved, 0 cleared | Max L.")));
  assert.ok(rows.some(r => r.startsWith("add player | Walk In | Max L.")));
  assert.ok(rows.some(r => r.startsWith("join | Jamie K. | sign-up form")));
  assert.ok(rows.some(r => r.startsWith("board password | new password created")));
  assert.ok(!rows.some(r => r.includes(KEY)));
});
ok("unnamed board user is logged as such", () => {
  post({ action: "addPlayer", key: KEY, name: "Nobody Named", by: "<b>" });
  assert.ok(G.__log().g.slice(-1)[0][3] === "board (unnamed)");
});
console.log(" mailing list");
const sub = (o) => post(Object.assign({ action: "subscribe", year: "2028", major: "Economics" }, o));
ok("subscribe stores email, first, last, class year and major in the Mailing list tab", () => {
  eq(sub({ fname: " Ada ", lname: "Lovelace", email: "Ada@Example.com", year: "2029", major: " Computer  Science " }), { ok: true });
  const row = G.__list().g[1];
  eq([row[0], row[1], row[2], row[4], row[5], row[6]], ["ada@example.com", "Ada", "Lovelace", "website", "2029", "Computer Science"]);
});
ok("subscribe needs a class year from 2027 to 2030 (no Other) and a major", () => {
  for (const year of ["", "Other", "2026", "2031", "=1+1"]) eq(sub({ fname: "A", lname: "B", email: "y@x.com", year }).field, "year");
  eq(sub({ fname: "A", lname: "B", email: "y@x.com", major: "" }).field, "major");
  eq(sub({ fname: "A", lname: "B", email: "y@x.com", major: "=HYPERLINK(1)" }).field, "major");
  eq(sub({ fname: "A", lname: "B", email: "y@x.com", major: "M".repeat(61) }).field, "major");
  eq(sub({ fname: "A", lname: "B", email: "y@x.com", year: "2027", major: "Law, Letters, and Society / Econ" }).ok, true);
});
ok("a page from before class year and major still signs up, with both blank", () => {
  eq(post({ action: "subscribe", fname: "Old", lname: "Page", email: "old.page@x.com" }), { ok: true });
  const row = G.__list().g.find((r) => r && r[0] === "old.page@x.com");
  eq([row[5], row[6]], ["", ""]);
});
ok("repeat email answers ok without a second row", () => {
  const before = G.__list().getLastRow();
  eq(sub({ fname: "Ada", lname: "L", email: "ADA@example.com" }), { ok: true });
  assert.strictEqual(G.__list().getLastRow(), before);
});
ok("subscribe accepts any email domain", () => assert.strictEqual(sub({ fname: "Recruiter", lname: "Smith", email: "rs@janestreet.com" }).ok, true));
ok("subscribe rejects bad email, formula names and missing last name", () => {
  assert.strictEqual(sub({ fname: "A", lname: "B", email: "nope" }).field, "email");
  assert.strictEqual(sub({ fname: "=HYPERLINK(1)", lname: "B", email: "x@y.com" }).field, "fname");
  assert.strictEqual(sub({ fname: "A", lname: "", email: "x@y.com" }).field, "lname");
  assert.strictEqual(sub({ fname: "A".repeat(31), lname: "B", email: "x@y.com" }).field, "fname");
});
ok("subscribe honeypot writes nothing", () => {
  const before = G.__list().getLastRow();
  assert.strictEqual(sub({ fname: "Bot", lname: "Bot", email: "bot@x.com", website: "spam" }).ok, true);
  assert.strictEqual(G.__list().getLastRow(), before);
});
ok("the mailing list never appears in the public feed", () => assert.ok(!JSON.stringify(get()).includes("example.com")));
ok("setup creates the Mailing list tab with headers", () => eq(G.__list().g[0], ["Email", "First Name", "Last Name", "Joined", "Source", "Class Year", "Major"]));
const listEnv = () => {
  const H = makeEnv();
  H.setupSheet();
  H.post = (b) => JSON.parse(H.doPost({ postData: { contents: JSON.stringify(Object.assign({ year: "2028", major: "History" }, b)) } }).getContent());
  return H;
};
ok("the form writes by header name, so columns the board reorders stay right", () => {
  const H = listEnv(), sh = H.__list();
  sh.g[0] = ["First Name", "Email", "Last Name", "Joined", "Source", "Notes"];
  eq(H.post({ action: "subscribe", fname: "Bo", lname: "Diaz", email: "bo@x.com" }), { ok: true });
  eq([sh.g[1][0], sh.g[1][1], sh.g[1][2], sh.g[1][4]], ["Bo", "bo@x.com", "Diaz", "website"]);
  eq(H.post({ action: "subscribe", fname: "Bo", lname: "D", email: " BO@x.com " }), { ok: true });
  eq(sh.getLastRow(), 2); // the repeat is found in the Email column, wherever it is
});
ok("a tab made before Class Year and Major gets those columns after its last column, never over data", () => {
  const H = listEnv(), sh = H.__list();
  sh.g[0] = ["Email", "First Name", "Last Name", "Joined", "Source"];
  sh.g[1] = ["old@x.com", "Old", "Member", "2026-01-01", "old mailing list", "a note in an unnamed column"];
  eq(H.post({ action: "subscribe", fname: "Cy", lname: "Ng", email: "cy@x.com", year: "2030", major: "Physics" }), { ok: true });
  eq([sh.g[0][5], sh.g[0][6], sh.g[0][7]], [undefined, "Class Year", "Major"]);
  eq(sh.g[1][5], "a note in an unnamed column");
  eq([sh.g[2][0], sh.g[2][6], sh.g[2][7]], ["cy@x.com", "2030", "Physics"]);
  eq(H.post({ action: "subscribe", fname: "Di", lname: "Ma", email: "di@x.com" }).ok, true);
  eq(sh.g[0].length, 8); // added once, then found by name
});
ok("set up puts back rows the old form wrote out of order, and leaves the rest alone", () => {
  const H = listEnv(), sh = H.__list();
  sh.g.push(["dan@uchicago.edu", "Daniel", "Steiner", "2026-09-27 22:20", "old mailing list"]);
  sh.g.push(["Joyce", "Li", "jxli@uchicago.edu", "2026-10-05 23:37", "website", "a note"]);
  H.setupSheet();
  eq(sh.g[1], ["dan@uchicago.edu", "Daniel", "Steiner", "2026-09-27 22:20", "old mailing list", "", ""]);
  eq(sh.g[2], ["jxli@uchicago.edu", "Joyce", "Li", "2026-10-05 23:37", "website", "a note", ""]);
  eq(H.repairListRows_(), 0);
});
console.log(" sponsor inquiries");
const sponsor = (o) => post(Object.assign({ action: "sponsor" }, o));
ok("sponsor inquiry is saved to the Sponsor inquiries tab and nothing is emailed", () => {
  const r = sponsor({ name: "Pat Recruiter", company: "D. E. Shaw & Co.", email: "Pat@DEShaw.com", message: "We would like the 2026-2027 prospectus." });
  eq([r.ok, r.name], [true, "Pat Recruiter"]);
  const row = G.__sponsors().g[1];
  eq([row[1], row[2], row[3], row[4], row[5]], ["Pat Recruiter", "D. E. Shaw & Co.", "pat@deshaw.com", "We would like the 2026-2027 prospectus.", "website"]);
  assert.strictEqual(G.__sent.length, 0);
});
ok("Code.gs has no way to send email", () => {
  const src = require("fs").readFileSync(require("path").join(__dirname, "..", "Code.gs"), "utf8");
  assert.ok(!/MailApp|GmailApp|sendEmail/.test(src));
});
ok("sponsor validation: name, company, email, message length", () => {
  assert.strictEqual(sponsor({ name: "", company: "X", email: "a@b.co" }).field, "name");
  assert.strictEqual(sponsor({ name: "Pat", company: "", email: "a@b.co" }).field, "company");
  assert.strictEqual(sponsor({ name: "Pat", company: "=HYPERLINK(1)", email: "a@b.co" }).field, "company");
  assert.strictEqual(sponsor({ name: "Pat", company: "Acme", email: "not-an-email" }).field, "email");
  assert.strictEqual(sponsor({ name: "Pat", company: "Acme", email: "a@b.co", message: "x".repeat(1001) }).field, "message");
});
ok("a message that looks like a formula is stored as text", () => {
  sponsor({ name: "Pat", company: "Acme", email: "a@b.co", message: '=IMPORTXML("http://x", A1)' });
  const sh = G.__sponsors();
  assert.strictEqual(sh.g[sh.getLastRow() - 1][4], '=IMPORTXML("http://x", A1)');
});
ok("sponsor honeypot saves nothing", () => {
  const rows = G.__sponsors().getLastRow();
  assert.strictEqual(sponsor({ name: "Bot", company: "Bot", email: "bot@x.com", website: "spam" }).ok, true);
  assert.strictEqual(G.__sponsors().getLastRow(), rows);
});
ok("each inquiry is logged by company", () => {
  sponsor({ name: "Sam", company: "Citadel", email: "sam@citadel.com" });
  assert.ok(G.__log().g.slice(-1)[0].slice(1, 3).join(" | ") === "sponsor inquiry | Citadel");
});
ok("sponsor inquiries are capped per hour", () => {
  let capped = 0;
  for (let i = 0; i < 25; i++) if (/Too many inquiries/.test(sponsor({ name: "Cap", company: "Cap", email: "c" + i + "@x.com" }).error || "")) capped++;
  assert.ok(capped > 0);
});
ok("sponsor details never appear in the public feed", () => assert.ok(!JSON.stringify(get()).includes("deshaw")));
console.log(" members log results, the board approves");
const realNight = G.nightDate_;
const night = (d) => { G.nightDate_ = () => d; };
// Settings are cached, so a test that writes one behind the script's back clears its cache entry too.
const setStack = (v) => { if (v === null) G.__props.delete("startingStack"); else G.__props.set("startingStack", v); G.__cache.delete("prop:startingStack"); };
const roster = (o) => post(Object.assign({ action: "roster", code: CODE }, o));
const submit = (o) => post(Object.assign({ action: "submit", code: CODE }, o));
const pendingFor = (name) => admin("load").data.submissions.find((s) => s.name === name);
const subRow = (name, status) => G.__submissions().g.slice(1).find((x) => x && x[3] === name && (!status || x[7] === status));
ok("a meeting night runs 4 p.m. to 4 a.m. Chicago", () => {
  eq([realNight(new Date("2026-10-09T23:30:00Z")), realNight(new Date("2026-10-10T06:30:00Z")), realNight(new Date("2026-10-09T15:00:00Z"))],
    ["2026-10-09", "2026-10-09", ""]);
});
ok("week labels map to dates in the term's year, for every month", () => {
  eq([G.weekDate_("Oct 9"), G.weekDate_("Nov 20"), G.weekDate_("Sept 3"), G.weekDate_("Week 1"), G.weekDate_("Oct 40")],
    ["2026-10-09", "2026-11-20", "2026-09-03", "", ""]);
  const labels = ["Jan 1", "Feb 2", "Mar 3", "Apr 4", "May 5", "Jun 6", "Jul 7", "Aug 8", "Sep 9", "Oct 10", "Nov 11", "Dec 12"];
  eq(labels.map((l) => G.weekDate_(l)), labels.map((l, i) => `2026-${String(i + 1).padStart(2, "0")}-${l.split(" ")[1].padStart(2, "0")}`));
});
ok("logging is closed outside a meeting night", () => {
  night("");
  assert.match(roster().error, /meeting night/);
  assert.match(submit({ name: "Jamie K.", chips: 1000 }).error, /meeting night/);
  night("2026-10-10"); // a night no week column names
  assert.match(roster().error, /meeting night/);
});
ok("the name list needs the meeting code, is sorted, and has no emails", () => {
  night("2026-10-16");
  setStack("10000");
  assert.match(roster({ code: "" }).error || "", /not right/);
  eq(roster({ code: "WRONG1" }).field, "code");
  const r = roster();
  eq([r.ok, r.week, r.startingStack], [true, "Oct 16", 10000]);
  assert.ok(r.names.includes("Jamie K.") && r.names.includes("Robin S."));
  eq(r.names, r.names.slice().sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
  assert.ok(!JSON.stringify(r).includes("@"));
});
ok("a logged result checks the code, the name and the chip count", () => {
  eq(submit({ code: "WRONG1", name: "Jamie K.", chips: 100 }).field, "code");
  eq(submit({ name: "Nobody Here", chips: 100 }).field, "name");
  eq(submit({ name: "=HYPERLINK(1)", chips: 100 }).field, "name");
  for (const chips of [-1, 2.5, 10000001, "abc", null, "=1+1"]) eq(submit({ name: "Jamie K.", chips }).field, "chips");
});
ok("a logged result waits as pending and stays off the public ledger", () => {
  const r = submit({ name: "jamie k.", chips: "12,500" });
  eq([r.ok, r.name, r.week, r.result, r.replaced], [true, "Jamie K.", "Oct 16", 2500, false]);
  assert.strictEqual(get().players.find((p) => p.name === "Jamie K.").results[1], null);
  eq(subRow("Jamie K.").slice(2, 10), ["Oct 16", "Jamie K.", 12500, 10000, 2500, "pending", 1, ""]);
});
ok("the same count sent again (a retry after a slow answer) changes nothing", () => {
  const r = submit({ name: "Jamie K.", chips: 12500 });
  eq([r.ok, r.result, r.replaced], [true, 2500, false]);
  eq(subRow("Jamie K.").slice(4, 10), [12500, 10000, 2500, "pending", 1, ""]);
});
ok("logging again updates the same row and keeps the earlier number", () => {
  const rows = G.__submissions().getLastRow();
  const r = submit({ name: "Jamie K.", chips: 13000 });
  eq([r.ok, r.replaced], [true, true]);
  eq(G.__submissions().getLastRow(), rows);
  eq(subRow("Jamie K.").slice(4, 10), [13000, 10000, 3000, "pending", 2, 12500]);
});
ok("a member can log at most five times a night", () => {
  for (const chips of [13001, 13002, 13003]) eq(submit({ name: "Jamie K.", chips }).ok, true);
  assert.match(submit({ name: "Jamie K.", chips: 1 }).error, /5 times/);
  eq(subRow("Jamie K.").slice(4, 10), [13003, 10000, 3003, "pending", 5, 13002]);
  eq([submit({ name: "Jamie K.", chips: 13003 }).ok, subRow("Jamie K.")[8]], [true, 5]); // a repeat is not a sixth log
});
ok("a request that cannot get the lock in time says the ledger is busy", () => {
  G.__lockBusy = true;
  try {
    assert.match(submit({ name: "Robin S.", chips: 7000 }).error, /^The ledger is busy/);
    assert.strictEqual(pendingFor("Robin S."), undefined);
  } finally {
    G.__lockBusy = false;
  }
});
ok("the board tool opens on tonight and gets each waiting entry once, with no emails", () => {
  const d = admin("load").data;
  eq([d.tonight, d.defaultWeek, d.meetingCode], ["Oct 16", "Oct 16", CODE]);
  eq(d.submissions.filter((s) => s.name === "Jamie K.").map((s) => [s.chips, s.stack, s.result, s.times, s.earlier]), [[13003, 10000, 3003, 5, 13002]]);
  assert.ok(!JSON.stringify(d).includes("@"));
});
ok("approving needs the board password and a counted number of chips", () => {
  const s = pendingFor("Jamie K.");
  assert.ok(post({ action: "review", key: "nope", id: s.id, decision: "approve", chips: 12000 }).auth);
  for (const chips of [undefined, "", -5, 2.5, 10000001]) assert.match(admin("review", { id: s.id, decision: "approve", chips }).error, /chips you counted/);
  eq(pendingFor("Jamie K.").id, s.id);
});
ok("approving writes counted chips minus the entry's own stack and keeps the member's number", () => {
  setStack("20000"); // the board tool's stack changed after Jamie logged against 10,000
  const s = pendingFor("Jamie K.");
  const r = admin("review", { id: s.id, decision: "approve", chips: 12000 });
  eq([r.ok, r.name, r.week, r.result], [true, "Jamie K.", "Oct 16", 2000]);
  assert.strictEqual(get().players.find((p) => p.name === "Jamie K.").results[1], 2000);
  const row = subRow("Jamie K.");
  eq([row[4], row[6], row[7], row[8], row[9], row[10], row[11]], [13003, 2000, "approved", 5, 13002, 12000, "Max L."]);
  assert.ok(G.__log().g.slice(-1)[0].slice(1, 4).join(" | ").startsWith("approved result | Oct 16: Jamie K., counted 12000 (logged 13003) | Max L."));
  setStack("10000");
});
ok("an approved result cannot be approved twice or logged over", () => {
  const id = subRow("Jamie K.", "approved")[0];
  assert.match(admin("review", { id, decision: "approve", chips: 12000 }).error, /already approved/);
  assert.match(submit({ name: "Jamie K.", chips: 20000 }).error, /already on the ledger/);
});
ok("rejecting writes nothing and lets the member log again", () => {
  eq(submit({ name: "Robin S.", chips: 8000 }).ok, true);
  const r = admin("review", { id: pendingFor("Robin S.").id, decision: "reject" });
  eq([r.ok, r.decision, r.name], [true, "reject", "Robin S."]);
  assert.strictEqual(get().players.some((p) => p.name === "Robin S."), false);
  eq(subRow("Robin S.", "rejected")[11], "Max L.");
  eq(submit({ name: "Robin S.", chips: 9000 }).ok, true);
  eq(pendingFor("Robin S.").chips, 9000);
  eq(admin("load").data.handled, { "Oct 16": 2 });
});
ok("bad review requests are refused and change nothing", () => {
  const s = pendingFor("Robin S.");
  assert.match(admin("review", { id: s.id, decision: "delete" }).error, /approve or reject/);
  assert.match(admin("review", { id: "nope", decision: "approve", chips: 1 }).error, /no longer there/);
  eq(pendingFor("Robin S.").id, s.id);
});
ok("approving never overwrites a result the board typed in, and that result locks logging", () => {
  admin("save", { week: "Oct 16", entries: [{ name: "Robin S.", value: 9500 }], startingStack: 10000 });
  assert.match(admin("review", { id: pendingFor("Robin S.").id, decision: "approve", chips: 9000 }).error, /already has a result/);
  assert.strictEqual(get().players.find((p) => p.name === "Robin S.").results[1], -500);
  assert.match(submit({ name: "Robin S.", chips: 9500 }).error, /already on the ledger/);
});
ok("a profit-or-loss save does not close logging", () => {
  admin("save", { week: "Oct 9", entries: [{ name: "Late", value: 300 }] }); // no stack, so 0 is stored
  eq(G.getAdminData_().startingStack, 0);
  const r = roster();
  eq([r.ok, r.startingStack], [true, 10000]);
  eq(submit({ name: "Late", chips: 10300 }).result, 300);
  setStack("10000");
});
ok("someone who joins at the meeting can log right away", () => {
  eq(join({ name: "New Face", email: "newface@uchicago.edu", year: "2030" }).ok, true);
  assert.ok(roster().names.includes("New Face"));
});
ok("after the night, the board tool opens on the week with entries still waiting", () => {
  night("");
  eq([admin("load").data.tonight, admin("load").data.defaultWeek], ["", "Oct 16"]);
  night("2026-10-16");
});
ok("a week cell Sheets turned into a date still reads as its label", () => {
  const sh = G.__submissions(), r = sh.g.findIndex((x) => x && x[3] === "Late");
  sh.g[r][2] = new Date("2026-10-16T17:00:00Z");
  eq(pendingFor("Late").week, "Oct 16");
  sh.g[r][2] = "Oct 16";
});
ok("the board can change and close the meeting code from the board tool", () => {
  eq(admin("setCode", { code: "poker-27" }).code, "POKER27");
  eq(roster().field, "code");
  CODE = "POKER27";
  eq(roster().ok, true);
  eq(admin("setCode", { code: "abc" }).ok, false);
  assert.ok(G.__log().g.slice(-1)[0].slice(1, 4).join(" | ").startsWith("meeting code | code changed | Max L."));
  assert.ok(post({ action: "setCode", key: "nope", code: "HACKED1" }).auth);
  eq(roster().ok, true);
});
ok("set up adds the Submissions tab with headers, and running it again is safe", () => {
  G.setupSheet();
  G.setupSheet();
  eq(G.__submissions().g[0], ["ID", "Logged", "Week", "Name", "Chips", "Stack", "Result", "Status", "Times", "Earlier chips", "Counted", "Reviewed by", "Reviewed at"]);
});
ok("unapproved results never reach the public feed", () => {
  eq(get().players.some((p) => p.name === "New Face"), false);
  eq(get().players.find((p) => p.name === "Late").results.slice(0, 2), [300, null]);
});
ok("weeks added from the menu must be dates members can log on", () => {
  assert.match(G.addWeek_("Week 8").error, /meeting date/);
  eq(G.addWeek_("Dec 4").ok, true);
  eq(get().weeks.slice(-1)[0], "Dec 4");
});
G.nightDate_ = realNight;
ok("the board tool defaults to a 10,000 chip starting stack, and a saved 0 sticks", () => {
  setStack(null);
  assert.strictEqual(G.getAdminData_().startingStack, 10000);
  setStack("0");
  assert.strictEqual(G.getAdminData_().startingStack, 0);
  setStack("10000");
});
ok("anonymous flood is cut off but the board still gets through", () => {
  let busy = 0;
  for (let i = 0; i < 320; i++) if (/busy/.test(post({ action: "load", key: "nope" }).error || "")) busy++;
  assert.ok(busy > 0, "flood not throttled");
  assert.match(join({ name: "Flooded", email: "f@uchicago.edu", year: "2028" }).error, /busy/);
  assert.strictEqual(admin("load").ok, true);
  assert.strictEqual(admin("save", { week: "Oct 30", entries: [{ name: "Walk In", value: 5 }] }).ok, true);
});
console.log(n + " backend checks passed");
