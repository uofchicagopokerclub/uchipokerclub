import { useState } from 'react';
import { club } from '../content/club';
import { endSentence, nameKey, signed, tone, wholeChips } from '../lib/ledger';
import { formatClock } from '../lib/schedule';

const LOG_ADDRESS = `${club.siteUrl.replace(/^https?:\/\//, '')}/ledger/log`;
const chipsText = (n) => Number(n).toLocaleString('en-US');

// Results members logged with the meeting code, waiting for a board member to see the chips. Approve writes the
// counted chips minus the stack the member logged against; reject writes nothing and the member can log again.
// The board tool's find box filters these cards, so a board member types a name and approves. Decisions update the
// tool's data in place (onDecided) instead of reloading everything after every tap.
// busy: a board request is in flight (a table save, say), so decisions wait for it.
export default function Approvals({ data, week, query, board, busy, onDecided, reload, onShowWeek }) {
  const [counted, setCounted] = useState({}); // entry id -> chips typed by the board member
  const [working, setWorking] = useState(false);
  const [note, setNote] = useState({ text: '', kind: '' });

  const label = data.weeks[week];
  const all = data.submissions || [];
  const pending = all.filter((s) => nameKey(s.week) === nameKey(label));
  const handled = (data.handled || {})[label] || 0;
  const elsewhere = data.weeks
    .map((w, i) => ({ w, i, n: all.filter((s) => nameKey(s.week) === nameKey(w)).length }))
    .filter((x) => x.i !== week && x.n > 0);
  const q = nameKey(query);
  const shown = q ? pending.filter((s) => nameKey(s.name).includes(q)) : pending;
  const onLedger = new Map(data.players.map((p) => [nameKey(p.name), p.results[week]]));
  const typedFor = (s) => counted[s.id] ?? String(s.chips);

  // One request at a time: every card waits while any decision or refresh is in flight.
  async function run(fn, { refresh = true } = {}) {
    setWorking(true);
    setNote({ text: '', kind: '' });
    try {
      await fn();
    } catch (err) {
      // An auth failure already locked the tool. Anything else (another board member got there first, the network)
      // is shown, and the list is refreshed before the cards come back, so no stale card stays tappable.
      if (!err.auth) {
        setNote({ text: err.message, kind: 'err' });
        if (refresh) await reload().catch(() => {});
      }
    } finally {
      setWorking(false);
    }
  }

  function decide(s, decision) {
    const chips = wholeChips(typedFor(s));
    if (decision === 'approve' && chips === null) {
      setNote({ text: endSentence(`Enter the chips you counted for ${s.name}`), kind: 'err' });
      return;
    }
    run(async () => {
      const r = await board('review', decision === 'approve' ? { id: s.id, decision, chips } : { id: s.id, decision });
      onDecided({ id: s.id, decision, name: r.name, week: r.week, result: r.result });
      setNote({
        text: decision === 'approve'
          ? `Approved ${r.name}: ${signed(r.result)}.`
          : `${endSentence(`Rejected ${r.name}`)} They can log again.`,
        kind: 'ok',
      });
    });
  }

  return (
    <section className="approvals" aria-labelledby="approvals-title">
      <div className="approvals-head">
        <h2 id="approvals-title">To approve{pending.length ? ` (${pending.length})` : ''}</h2>
        <button className="btn btn-secondary" type="button" onClick={() => run(reload, { refresh: false })} disabled={working || busy}>Refresh</button>
      </div>
      {elsewhere.length > 0 && (
        <p className="approvals-elsewhere">
          Also waiting:
          {elsewhere.map((x) => (
            <button key={x.w} className="link-btn" type="button" onClick={() => onShowWeek(x.i)}>{x.w} ({x.n})</button>
          ))}
        </p>
      )}
      {!pending.length ? (
        <p className="approvals-empty">
          {handled
            ? `Everything logged for ${label} is handled.`
            : `Nothing logged for ${label} yet. Members log at ${LOG_ADDRESS} with the meeting code.`}
        </p>
      ) : !shown.length ? (
        <p className="approvals-empty">Nobody with that name is waiting.</p>
      ) : (
        <ul className="approval-list">
          {shown.map((s) => {
            const typed = typedFor(s);
            const c = wholeChips(typed);
            const net = c !== null ? c - s.stack : s.result;
            const already = onLedger.get(nameKey(s.name));
            const settled = already !== null && already !== undefined;
            const at = formatClock(s.at);
            return (
              <li key={s.id} className="approval">
                <div className="approval-top">
                  <b>{s.name}</b>
                  <span className={`approval-net ${tone(net)}`}>{signed(net)}</span>
                </div>
                <p className="approval-meta">
                  Logged {chipsText(s.chips)} chips{at ? ` at ${at}` : ''}.
                  {s.times > 1 && s.earlier !== null ? ` Changed from ${chipsText(s.earlier)} (${s.times} entries).` : ''}
                </p>
                {settled && (
                  <p className="approval-warn tc-off">
                    The ledger already has {signed(already)} for {label}. Reject this entry, or change the number in the table.
                  </p>
                )}
                <div className="approval-actions">
                  <label className="field">
                    <span className="field-label">Chips counted</span>
                    <input
                      className="input" inputMode="numeric" autoComplete="off" value={typed}
                      onChange={(e) => { const v = e.target.value; setCounted((m) => ({ ...m, [s.id]: v })); }}
                    />
                  </label>
                  <button className="btn btn-secondary" type="button" onClick={() => decide(s, 'reject')} disabled={working || busy}>Reject</button>
                  <button className="btn btn-primary" type="button" onClick={() => decide(s, 'approve')} disabled={working || busy || settled}>
                    Approve
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {note.text && <p className={note.kind === 'err' ? 'msg-err' : 'msg-ok'} role="status">{note.text}</p>}
    </section>
  );
}
