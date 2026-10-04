import Link from 'next/link';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { ledger, schedule } from '../content/club';
import { getStandingsInBrowser } from '../lib/api';
import { computeStandings, money, searchKey, signed, tone } from '../lib/ledger';
import { formatDay } from '../lib/schedule';
import { SearchIcon } from './Icons';

// Standings come pre-rendered from the server (refreshed every 60 seconds). If the server could not
// reach the Sheet, the browser fetches them instead and shows placeholder rows meanwhile.
export function useStandings(initialFeed, connected) {
  const [feed, setFeed] = useState(initialFeed);
  const [status, setStatus] = useState(initialFeed || !connected ? 'ready' : 'loading');

  useEffect(() => {
    if (initialFeed || !connected) return undefined;
    let alive = true;
    getStandingsInBrowser()
      .then((f) => { if (alive) { setFeed(f); setStatus('ready'); } })
      .catch(() => { if (alive) setStatus('error'); });
    return () => { alive = false; };
  }, [initialFeed, connected]);

  const standings = useMemo(() => computeStandings(feed || {}), [feed]);
  return { standings, status };
}

export function firstMeetingLine() {
  const first = schedule.meetings.find((m) => !m.event) || schedule.meetings[0];
  return first ? `Standings post after the first meeting on ${formatDay(first.date)}.` : 'Standings post after the first meeting.';
}

export function metaLine(standings) {
  const { latest, weeks, players } = standings;
  if (latest < 0) return firstMeetingLine();
  const n = players.length;
  return `Updated through ${weeks[latest]}. Week ${latest + 1} of ${weeks.length}, ${n} ${n === 1 ? 'player' : 'players'}.`;
}

function Move({ p }) {
  if (p.move === null) return null;
  let cls = 'same', glyph = '=', text = 'No change since last week';
  if (p.move === 'new') { cls = 'new'; glyph = 'NEW'; text = 'First week on the ledger'; }
  else if (p.move > 0) { cls = 'up'; glyph = `\u25b2${p.move}`; text = `Up ${p.move} since last week`; }
  else if (p.move < 0) { cls = 'down'; glyph = `\u25bc${-p.move}`; text = `Down ${-p.move} since last week`; }
  return (
    <span className={cls} title={text}>
      <span aria-hidden="true">{glyph}</span>
      <span className="sr-only">{text}</span>
    </span>
  );
}

function Last({ p, inline }) {
  if (p.last === null) return <span className="dnp">{inline ? 'did not play' : 'DNP'}</span>;
  return <span className={tone(p.last)}>{signed(p.last)}</span>;
}

function SkeletonRows({ cols }) {
  return Array.from({ length: 6 }, (_, i) => (
    <tr className="skeleton" key={i} aria-hidden="true">
      <td colSpan={cols}><span style={{ width: `${70 - i * 6}%` }} /></td>
    </tr>
  ));
}

export default function LedgerTable({ standings, status }) {
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState(false);

  const { latest, weeks, players } = standings;
  const label = latest >= 0 ? weeks[latest] : '';
  const showMove = latest > 0;
  const paidPlaces = ledger.payouts.length;
  const limit = ledger.rowsBeforeShowAll;
  const total = players.length;

  const query = searchKey(q.trim());
  const list = query ? players.filter((p) => searchKey(p.name).includes(query)) : players;
  const limited = !query && !expanded && list.length > limit + 5;
  const shown = limited ? list.slice(0, limit) : list;
  const cols = showMove ? 7 : 6;

  if (status === 'error') {
    return <p className="ledger-state">Standings could not load right now. Refresh the page to try again.</p>;
  }
  if (status === 'ready' && latest < 0) {
    return (
      <div className="ledger-state">
        <p>No results recorded yet. {firstMeetingLine()}</p>
        <div className="actions" style={{ marginTop: 18 }}>
          <Link className="btn btn-primary" href="/ledger/join">Join the ledger</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="ledger-tools">
        <label className="search">
          <span className="sr-only">Find a player</span>
          <SearchIcon />
          <input className="input" type="search" placeholder="Find a player" autoComplete="off" autoCorrect="off" spellCheck="false" value={q} onChange={(e) => setQ(e.target.value)} disabled={status !== 'ready'} />
        </label>
        <span className="ledger-count" aria-live="polite">
          {query ? `${list.length} ${list.length === 1 ? 'match' : 'matches'}` : limited ? `Top ${limit} of ${total}` : ''}
        </span>
      </div>

      <div className="table-scroll">
        <table className="ledger-table">
          <caption className="sr-only">{label ? `Ledger standings through ${label}` : 'Ledger standings'}</caption>
          <thead>
            <tr>
              <th className="c-rank" scope="col">#</th>
              {showMove && <th className="c-move" scope="col"><span className="sr-only">Change since last week</span></th>}
              <th scope="col">Player</th>
              <th className="c-wk num" scope="col">Weeks</th>
              <th className="c-last num" scope="col">{label || 'Last'}</th>
              <th className="c-total num" scope="col">Ledger</th>
              <th className="c-pay" scope="col"><span className="sr-only">Prize</span></th>
            </tr>
          </thead>
          <tbody>
            {status === 'loading' && <SkeletonRows cols={cols} />}
            {status === 'ready' && shown.length === 0 && (
              <tr><td colSpan={cols} className="ledger-state">No player matches &ldquo;{q.trim()}&rdquo;.</td></tr>
            )}
            {status === 'ready' && shown.map((p, i) => {
              const paid = p.rank <= paidPlaces;
              // A tie inside the paid places shows "Tied" rather than a dollar figure; the board settles it.
              const prize = !paid ? '' : p.tied ? 'Tied' : money(ledger.payouts[p.rank - 1]);
              const pill = p.tied ? 'pill pill-tie' : 'pill';
              const next = shown[i + 1];
              return (
                <Fragment key={`${p.name}#${i}`}>
                <tr className={paid ? 'paid' : undefined}>
                  <td className="c-rank">{p.tied ? 'T' : ''}{p.rank}</td>
                  {showMove && <td className="c-move"><Move p={p} /></td>}
                  <td>
                    <span className="nm">{p.name}</span>
                    <span className="sub">
                      {showMove && <><Move p={p} />{', '}</>}
                      {p.played} {p.played === 1 ? 'wk' : 'wks'}, {label} <Last p={p} inline />
                    </span>
                  </td>
                  <td className="c-wk num">{p.played}</td>
                  <td className="c-last num"><Last p={p} /></td>
                  <td className={`c-total num ${tone(p.total)}`}>
                    {signed(p.total)}
                    {paid && <span className={`${pill} pill-m`}>{prize}</span>}
                  </td>
                  <td className="c-pay">{paid && <span className={pill}>{prize}</span>}</td>
                </tr>
                {!query && paid && next && next.rank > paidPlaces && (
                  <tr className="prize-line-row" aria-hidden="true">
                    <td colSpan={cols}><div className="prize-line-label">Prize line</div></td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {limited && (
        <button type="button" className="btn btn-secondary more" onClick={() => setExpanded(true)}>
          Show all {total} players
        </button>
      )}
      {expanded && !query && list.length > limit + 5 && (
        <button type="button" className="btn btn-secondary more" onClick={() => setExpanded(false)}>
          Show top {limit}
        </button>
      )}
    </div>
  );
}
