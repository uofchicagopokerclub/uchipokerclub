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
ok("closed until a sign-up code exists (fail closed)", () => assert.match(post({ name: "A", email: "a@uchicago.edu", year: "2028" }).error, /closed/));
ok("sign-up code set and normalized", () => { const r = G.setSignupCode_(" poker-26 "); CODE = r.code; assert.strictEqual(CODE, "POKER26"); });
ok("code shorter than 6 rejected", () => assert.strictEqual(G.setSignupCode_("ABCDE").ok, false));
ok("wrong code rejected before any field feedback", () => {
  const r = post({ code: "nope", name: "<script>", email: "x", year: "x" });
  assert.strictEqual(r.field, "code");
});
ok("code is case-insensitive", () => assert.strictEqual(join({ code: "poker26", name: "Jamie K.", email: "jamie@uchicago.edu", year: "2029" }).ok, true));
ok("duplicate email rejected", () => assert.strictEqual(join({ name: "Other", email: "JAMIE@uchicago.edu", year: "2029" }).field, "email"));
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
const sub = (o) => post(Object.assign({ action: "subscribe" }, o));
ok("subscribe stores first, last, email in the Mailing list tab", () => {
  eq(sub({ fname: " Ada ", lname: "Lovelace", email: "Ada@Example.com" }), { ok: true });
  const row = G.__list().g[1];
  eq([row[0], row[1], row[2], row[4]], ["Ada", "Lovelace", "ada@example.com", "website"]);
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
ok("setup creates the Mailing list tab with headers", () => eq(G.__list().g[0], ["First Name", "Last Name", "Email", "Joined", "Source"]));
ok("anonymous flood is cut off but the board still gets through", () => {
  let busy = 0;
  for (let i = 0; i < 320; i++) if (/busy/.test(post({ action: "load", key: "nope" }).error || "")) busy++;
  assert.ok(busy > 0, "flood not throttled");
  assert.match(join({ name: "Flooded", email: "f@uchicago.edu", year: "2028" }).error, /busy/);
  assert.strictEqual(admin("load").ok, true);
  assert.strictEqual(admin("save", { week: "Oct 30", entries: [{ name: "Walk In", value: 5 }] }).ok, true);
});
console.log(n + " backend checks passed");
