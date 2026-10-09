import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { postToLedger } from '../lib/api';
import { endSentence, nameKey, parseChips, signed, tone } from '../lib/ledger';
import Approvals from './Approvals';
import StillWorking from './StillWorking';
import SubmitButton from './SubmitButton';

// Board tool. The board password is checked by the Apps Script on every request; this page only
// hides the form. Without "Remember", the password lives in memory and is gone on refresh.
const STORE_KEY = 'ucpc-board-key';
const STORE_BY = 'ucpc-board-name';
const REMEMBER_MS = 30 * 24 * 3600 * 1000;

function recall() {
  try {
    const o = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (o && o.k && o.exp > Date.now()) return o.k;
    localStorage.removeItem(STORE_KEY);
  } catch {}
  return '';
}
function remember(k) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ k, exp: Date.now() + REMEMBER_MS })); } catch {}
}
function forgetKey() {
  try { localStorage.removeItem(STORE_KEY); } catch {}
}
function readName() {
  try { return localStorage.getItem(STORE_BY) || ''; } catch { return ''; }
}
function writeName(v) {
  try { localStorage.setItem(STORE_BY, v); } catch {}
}

export default function RecordResults() {
  const session = useRef({ key: '', by: '' });
  const [phase, setPhase] = useState('init'); // init | locked | ready
  const [lockMsg, setLockMsg] = useState('');
  const [byInput, setByInput] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  const [data, setData] = useState(null);
  const [week, setWeek] = useState(0);
  // A Map, not a plain object: a player named "constructor" or "toString" must be just a name.
  const [edits, setEdits] = useState(() => new Map());
  const [startText, setStartText] = useState('');
  const [query, setQuery] = useState('');
  const [msg, setMsg] = useState({ text: '', kind: '' });
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(0); // board requests in flight, for the footer's "Still working" line
  // One board request at a time: a decision and a table save racing each other could overwrite one another.
  const waiting = busy || pending > 0;
  const [codeEdit, setCodeEdit] = useState(null); // the meeting code being typed, or null when not editing
  const tableRef = useRef(null);
  const findRef = useRef(null);
  const focusFirst = useRef(false);
  // The week on screen when a slow request finishes, not when it started.
  const weekRef = useRef(0);
  weekRef.current = week;

  // keepKey: a network error rather than a wrong password, so the saved password stays and Unlock retries it.
  const lock = useCallback((message, keepKey = false) => {
    if (keepKey) {
      setKeyInput(session.current.key);
      setRememberMe(Boolean(recall()));
    } else {
      session.current.key = '';
      forgetKey();
      setKeyInput('');
      setRememberMe(false);
    }
    setByInput(session.current.by);
    setLockMsg(message || '');
    setPhase('locked');
  }, []);

  // timeout 0: the board tool waits for every answer, however slow (see lib/api.js).
  const board = useCallback(async (action, extra = {}) => {
    setPending((n) => n + 1);
    let res;
    try {
      res = await postToLedger({ action, key: session.current.key, by: session.current.by, ...extra }, { timeout: 0 });
    } finally {
      setPending((n) => n - 1);
    }
    if (res.auth) {
      lock(res.error);
      const err = new Error(res.error);
      err.auth = true;
      throw err;
    }
    if (!res.ok) throw new Error(res.error || 'Something went wrong.');
    return res;
  }, [lock]);

  const load = useCallback(async ({ keepWeek = null, keepEdits = false } = {}) => {
    const res = await board('load');
    const d = res.data;
    setData(d);
    setWeek(Math.max(0, keepWeek !== null ? keepWeek : d.weeks.indexOf(d.defaultWeek)));
    // Kept edits keep the stack they were typed against, even a deliberately empty one (profit or loss).
    if (!keepEdits) {
      setStartText((s) => (s || !d.startingStack ? s : String(d.startingStack)));
      setEdits(new Map());
    }
    setPhase('ready');
  }, [board]);

  // Refresh for the approvals list: whatever week is on screen, with unsaved table edits kept.
  const reload = useCallback(() => load({ keepWeek: weekRef.current, keepEdits: true }), [load]);

  // A decision from the approvals list, applied to the data in place.
  const onDecided = useCallback(({ id, decision, name, week: label, result }) => {
    setData((d) => {
      const w = d.weeks.findIndex((x) => nameKey(x) === nameKey(label));
      const players = decision === 'approve' && w >= 0
        ? d.players.map((p) => (nameKey(p.name) === nameKey(name) ? { ...p, results: p.results.map((v, i) => (i === w ? result : v)) } : p))
        : d.players;
      const handled = { ...(d.handled || {}), [label]: ((d.handled || {})[label] || 0) + 1 };
      return { ...d, players, handled, submissions: d.submissions.filter((s) => s.id !== id) };
    });
    // An unsaved table edit for the same player would overwrite the approved result on the next Save.
    if (decision === 'approve') {
      setEdits((m) => {
        if (!m.has(nameKey(name))) return m;
        const next = new Map(m);
        next.delete(nameKey(name));
        return next;
      });
    }
  }, []);

  useEffect(() => {
    session.current = { key: recall(), by: readName() };
    setByInput(session.current.by);
    if (!session.current.key) { setPhase('locked'); return; }
    load().catch((err) => {
      // An auth failure already locked the screen; anything else is a network problem.
      if (!err.auth) lock(err.message, true);
    });
  }, [load, lock]);

  const start = useMemo(() => {
    const v = parseChips(startText);
    return v && v > 0 ? v : 0;
  }, [startText]);

  const shown = useCallback((p) => {
    const v = p.results[week];
    if (v === null || v === undefined) return '';
    return String(start ? v + start : v);
  }, [week, start]);

  const textFor = useCallback((p) => {
    const k = nameKey(p.name);
    return edits.has(k) ? edits.get(k) : shown(p);
  }, [edits, shown]);

  const netFor = useCallback((text) => {
    if (String(text).trim() === '') return { blank: true };
    const v = parseChips(text);
    if (v === null || (start && v < 0)) return { bad: true };
    return { value: start ? v - start : v };
  }, [start]);

  const isChanged = useCallback((p) => {
    const k = nameKey(p.name);
    if (!edits.has(k)) return false;
    const a = netFor(edits.get(k));
    const b = netFor(shown(p));
    return Boolean(a.bad || (a.blank ? !b.blank : b.blank || a.value !== b.value));
  }, [edits, netFor, shown]);

  const changes = useMemo(() => (data ? data.players.filter(isChanged) : []), [data, isChanged]);
  // The stack members log against is saved with results, so it can also be saved on its own.
  const stackChanged = Boolean(data) && start !== (data.startingStack || 0);

  const stats = useMemo(() => {
    let played = 0, net = 0;
    if (data) {
      for (const p of data.players) {
        const n = netFor(textFor(p));
        if (n.value !== undefined) { played += 1; net += n.value; }
      }
    }
    const bad = changes.some((p) => netFor(edits.get(nameKey(p.name))).bad);
    return { played, net, bad };
  }, [data, netFor, textFor, changes, edits]);

  useEffect(() => {
    if (!changes.length) return undefined;
    const onLeave = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [changes.length]);

  useEffect(() => {
    if (!focusFirst.current) return;
    focusFirst.current = false;
    tableRef.current?.querySelector('tbody input')?.focus();
  });

  async function unlock(e) {
    e.preventDefault();
    const by = byInput.replace(/\s+/g, ' ').trim();
    const key = keyInput.trim();
    if (!by) { setLockMsg('Enter your name for the change log.'); return; }
    if (!key) { setLockMsg('Enter the board password.'); return; }
    session.current = { key, by };
    // After a forced lock mid-entry, come back to the same week with the typed results intact.
    const resume = Boolean(data && changes.length > 0);
    setUnlocking(true);
    setLockMsg('');
    try {
      await load({ keepWeek: resume ? week : null, keepEdits: resume });
      writeName(by);
      if (rememberMe) remember(key); else forgetKey();
      if (resume) setMsg({ text: 'Your unsaved changes are still here. Press Save.', kind: 'ok' });
    } catch (err) {
      setLockMsg(err.message);
    } finally {
      setUnlocking(false);
    }
  }

  async function save() {
    // What is being sent, so entries typed while a slow save is in flight survive the reload after it.
    const sent = new Map(changes.map((p) => [nameKey(p.name), edits.get(nameKey(p.name))]));
    const entries = changes.map((p) => {
      const t = sent.get(nameKey(p.name));
      return { name: p.name, value: t.trim() === '' ? null : parseChips(t) };
    });
    setBusy(true);
    setMsg({ text: '', kind: '' });
    try {
      const r = await board('save', { week: data.weeks[week], entries, startingStack: start });
      const parts = [];
      if (r.saved) parts.push(`Saved ${r.saved} ${r.saved === 1 ? 'result' : 'results'}`);
      if (r.cleared) parts.push(`cleared ${r.cleared}`);
      const missing = r.missing || [];
      await load({ keepWeek: week, keepEdits: true });
      setEdits((m) => {
        const next = new Map(m);
        sent.forEach((t, k) => { if (next.get(k) === t) next.delete(k); });
        return next;
      });
      if (missing.length) {
        setMsg({ text: `${parts.length ? `${parts.join(', ')}. ` : ''}Not saved, no longer on the ledger: ${missing.join(', ')}`, kind: 'err' });
      } else {
        if (!parts.length && stackChanged) setMsg({ text: `Starting stack saved: ${start ? start.toLocaleString('en-US') : 'none (profit or loss)'}.`, kind: 'ok' });
        else setMsg({ text: `${parts.join(', ') || 'No changes'} for ${r.week}.`, kind: 'ok' });
      }
    } catch (err) {
      setMsg({ text: err.message, kind: 'err' });
    } finally {
      setBusy(false);
    }
  }

  async function addPlayer() {
    const name = query.trim();
    if (!name || waiting) return; // Enter in the find box reaches here even while a request is in flight
    setBusy(true);
    try {
      const r = await board('addPlayer', { name });
      setData((d) => ({ ...d, players: [...d.players, { name: r.name, results: d.weeks.map(() => null) }] }));
      setQuery(r.name);
      setMsg({ text: endSentence(`Added ${r.name}`), kind: 'ok' });
      focusFirst.current = true;
    } catch (err) {
      setMsg({ text: err.message, kind: 'err' });
    } finally {
      setBusy(false);
    }
  }

  // The Sheet's Ledger menu does not exist in the Google Sheets phone app, so the code is changed from here.
  async function saveCode(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await board('setCode', { code: codeEdit });
      setData((d) => ({ ...d, meetingCode: r.code }));
      setCodeEdit(null);
      setMsg({ text: r.code ? `The meeting code is now ${r.code}.` : 'Joining and logging are closed until you set a code.', kind: 'ok' });
    } catch (err) {
      if (!err.auth) setMsg({ text: err.message, kind: 'err' });
    } finally {
      setBusy(false);
    }
  }

  function showWeek(i) {
    if (changes.length) {
      setMsg({ text: `Save or discard your changes to ${data.weeks[week]} first.`, kind: 'err' });
      return;
    }
    setWeek(i);
    setEdits(new Map());
    setMsg({ text: '', kind: '' });
  }

  function changeWeek(e) {
    showWeek(Number(e.target.value));
  }

  function onEntryKey(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const inputs = Array.from(tableRef.current?.querySelectorAll('tbody input') || []);
    const next = inputs[inputs.indexOf(e.target) + 1];
    if (next) { next.focus(); next.select(); } else { findRef.current?.focus(); findRef.current?.select(); }
  }

  if (phase === 'init') return <><p className="ledger-state">Loading the board tool.</p><StillWorking busy /></>;

  if (phase === 'locked') {
    return (
      <form className="form" onSubmit={unlock} noValidate style={{ maxWidth: 440 }}>
        <label className="field">
          <span className="field-label">Your name</span>
          <input className="input" maxLength={40} autoComplete="name" value={byInput} onChange={(e) => setByInput(e.target.value)} />
          <span className="field-help">Goes in the change log next to anything you save.</span>
        </label>
        <label className="field">
          <span className="field-label">Board password</span>
          <input className="input" type="password" autoComplete="current-password" spellCheck="false" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} />
          <span className="field-help">From the club Google Sheet: Ledger &gt; New board password.</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
          Remember on this device for 30 days (your own device only)
        </label>
        {lockMsg && <p className="form-error" role="alert">{lockMsg}</p>}
        <div><SubmitButton busy={unlocking} busyLabel="Unlocking">Unlock</SubmitButton></div>
      </form>
    );
  }

  const q = nameKey(query);
  const list = data.players.filter((p) => !q || nameKey(p.name).includes(q));
  const exact = data.players.some((p) => nameKey(p.name) === q);
  const net = Math.round(stats.net);
  const seen = new Set();
  const dupes = [...new Set(data.players.map((p) => nameKey(p.name)).filter((k) => (seen.has(k) ? true : (seen.add(k), false))))];

  return (
    <div className="board-tool">
      <p className="who">
        Signed in as {session.current.by || 'board'}
        <button
          className="link-btn" type="button"
          onClick={() => {
            if (changes.length) { setMsg({ text: 'Save or discard your changes before locking.', kind: 'err' }); return; }
            lock('');
          }}
        >
          Lock
        </button>
      </p>

      {/* An older backend sends no code at all; showing "closed" then would be wrong, so the row waits for it. */}
      {data.meetingCode !== undefined && <div className="code-row">
        <span className="field-label">Meeting code</span>
        {codeEdit === null ? (
          <p className="code-show">
            <b>{data.meetingCode || 'None, so joining and logging are closed'}</b>
            <button className="link-btn" type="button" onClick={() => setCodeEdit(data.meetingCode || '')}>Change</button>
          </p>
        ) : (
          <>
            <form className="code-edit" onSubmit={saveCode} noValidate>
              <input
                className="input" aria-label="New meeting code" maxLength={20} autoComplete="off" autoCapitalize="characters"
                autoCorrect="off" spellCheck="false" value={codeEdit} onChange={(e) => setCodeEdit(e.target.value)}
              />
              <button className="btn btn-primary" type="submit" disabled={waiting}>Save code</button>
              <button className="btn btn-secondary" type="button" onClick={() => setCodeEdit(null)}>Cancel</button>
            </form>
            <span className="field-help">Members need it to join and to log results. Set a new one at each meeting, and clear it when the meeting ends.</span>
          </>
        )}
      </div>}

      <div className="controls" style={{ marginTop: 20 }}>
        <label className="field">
          <span className="field-label">Week</span>
          <select className="input" value={week} onChange={changeWeek}>
            {data.weeks.map((w, i) => <option key={w} value={i}>{w}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Starting stack</span>
          <input className="input" inputMode="numeric" placeholder="none" autoComplete="off" value={startText} onChange={(e) => setStartText(e.target.value)} />
        </label>
        <p className="hint">
          {start
            ? `Type end-of-night chip counts. The ledger stores count minus ${Math.round(start).toLocaleString('en-US')}.`
            : "Type each player's profit or loss for the night, like 2500 or -1200. Set a starting stack to type chip counts instead."}
        </p>
      </div>

      {dupes.length > 0 && (
        <p className="msg-err" role="alert" style={{ marginTop: 16 }}>
          The Sheet has more than one row named {dupes.join(', ')}. Rename one in the Players tab before entering results for them.
        </p>
      )}

      <div className="find">
        <label className="sr-only" htmlFor="find-player">Find or add a player</label>
        <input
          id="find-player" ref={findRef} className="input" placeholder="Find or add a player" autoComplete="off" autoCapitalize="words" autoCorrect="off" spellCheck="false"
          value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            // Enter jumps to the first match. It adds a new player only when nothing matches at all.
            if (q && !list.length) { addPlayer(); return; }
            tableRef.current?.querySelector('tbody input')?.focus();
          }}
        />
        {q && !exact && (
          <button className="btn btn-primary" type="button" onClick={addPlayer} disabled={waiting}>Add &ldquo;{query.trim()}&rdquo;</button>
        )}
      </div>

      <Approvals data={data} week={week} query={query} board={board} busy={waiting} onDecided={onDecided} reload={reload} onShowWeek={showWeek} />

      {!data.players.length ? (
        <p className="ledger-state">No players yet. People join through the sign-up form, or type a name above and press Add.</p>
      ) : !list.length ? (
        <p className="ledger-state">No player matches. Press Add to put them on the ledger.</p>
      ) : (
        <div className="table-scroll">
          <table className="rec-table" ref={tableRef}>
            <thead>
              <tr><th>Player</th><th className="r">{start ? 'Chip count' : 'Profit or loss'}</th><th className="r">Net</th></tr>
            </thead>
            <tbody>
              {list.map((p, i) => {
                const text = textFor(p);
                const n = netFor(text);
                const changed = isChanged(p);
                return (
                  <tr key={`${p.name}#${i}`} className={[changed ? 'changed' : '', n.bad ? 'bad' : ''].join(' ').trim() || undefined}>
                    <td className="nm">{p.name}</td>
                    <td className="in">
                      {/* The iPhone number pad has no minus key, so profit or loss entries, which can be negative, get the full keyboard. */}
                      <input
                        className="input" inputMode={start ? 'numeric' : 'text'} enterKeyHint="next" autoComplete="off" aria-label={p.name} value={text}
                        onChange={(e) => { const v = e.target.value; setEdits((m) => new Map(m).set(nameKey(p.name), v)); }}
                        onKeyDown={onEntryKey}
                      />
                    </td>
                    <td className={`net r ${n.bad ? 'neg' : n.blank ? 'dnp' : tone(n.value)}`}>
                      {n.bad ? 'not a number' : n.blank ? 'DNP' : signed(n.value)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="rec-foot">
        <p className="rec-stats">
          <b>{stats.played}</b> {stats.played === 1 ? 'player' : 'players'} this week
          {stats.played > 0 && (
            <>
              {'. '}
              <span className={net === 0 ? 'tc-ok' : 'tc-off'}>
                {net === 0 ? 'Table check: balanced' : `Table check: ${signed(net)} (should be 0 once every stack is in)`}
              </span>
            </>
          )}
          {changes.length > 0 && <>{'. '}<b>{changes.length}</b> unsaved</>}
        </p>
        {msg.text && <span className={msg.kind === 'ok' ? 'msg-ok' : 'msg-err'} role="status">{msg.text}</span>}
        {changes.length > 0 && (
          <button className="btn btn-secondary" type="button" onClick={() => { setEdits(new Map()); setMsg({ text: 'Changes discarded.', kind: 'ok' }); }}>Discard</button>
        )}
        <button className="btn btn-primary" type="button" onClick={save} disabled={waiting || (!changes.length && !stackChanged) || stats.bad}>
          {changes.length ? `Save ${changes.length}` : 'Save'}
        </button>
        {/* Sticky at the bottom of the screen, so it shows wherever the board member tapped. */}
        <StillWorking busy={pending > 0} />
      </div>
    </div>
  );
}
