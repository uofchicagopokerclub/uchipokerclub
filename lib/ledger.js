// Standings math for the ledger. Pure functions, shared by the pages and the tests.
// Input is the Apps Script feed: { term, weeks: ["Oct 9", ...], players: [{ name, results: [number|null, ...] }] }.

export const MINUS = '\u2212'; // typographic minus

// Keeps only the fields the site uses, with numbers or null, so the data is safe to render and serialize.
export function cleanFeed(json) {
  if (!json || typeof json !== 'object') return null;
  const weeks = Array.isArray(json.weeks) ? json.weeks.map((w) => String(w)) : [];
  const players = Array.isArray(json.players)
    ? json.players
        .filter((p) => p && typeof p.name === 'string' && p.name.trim())
        .map((p) => ({
          name: p.name.trim(),
          results: weeks.map((_, w) => {
            const v = Array.isArray(p.results) ? p.results[w] : null;
            return typeof v === 'number' && Number.isFinite(v) ? v : null;
          }),
        }))
    : [];
  return { term: typeof json.term === 'string' ? json.term : '', weeks, players };
}

export function computeStandings(feed) {
  const clean = cleanFeed(feed) || { term: '', weeks: [], players: [] };
  const { weeks } = clean;

  let latest = -1;
  for (const p of clean.players) {
    p.results.forEach((v, w) => {
      if (v !== null && w > latest) latest = w;
    });
  }

  const players = clean.players.map((p) => {
    let total = 0, played = 0, prevTotal = 0, prevPlayed = 0;
    for (let w = 0; w <= latest; w++) {
      const v = p.results[w];
      if (v === null) continue;
      total += v;
      played += 1;
      if (w < latest) {
        prevTotal += v;
        prevPlayed += 1;
      }
    }
    return {
      name: p.name,
      results: p.results,
      total,
      played,
      prevTotal,
      prevPlayed,
      last: latest >= 0 ? p.results[latest] : null,
      rank: 0,
      tied: false,
      prevRank: null,
      move: null,
    };
  });

  const active = players.filter((p) => p.played > 0);
  const ranked = rank(active, 'total', 'rank');
  rank(active.filter((p) => p.prevPlayed > 0), 'prevTotal', 'prevRank');
  for (const p of ranked) {
    if (latest > 0) p.move = p.prevPlayed ? p.prevRank - p.rank : 'new';
  }

  return { term: clean.term, weeks, latest, players: ranked };
}

// Competition ranking: equal totals share a rank (1, 2, 2, 4). Ties broken alphabetically for display.
function rank(list, key, out) {
  const sorted = list.slice().sort((a, b) => b[key] - a[key] || a.name.localeCompare(b.name));
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1];
    const next = sorted[i + 1];
    p[out] = prev && prev[key] === p[key] ? prev[out] : i + 1;
    if (out === 'rank') p.tied = Boolean((prev && prev[key] === p[key]) || (next && next[key] === p[key]));
  });
  return sorted;
}

// Accepts what people actually type: 2500, -1,200, $10,500, (300), a typographic minus.
export function parseChips(raw) {
  let t = String(raw == null ? '' : raw).trim().replace(/[\u2212\u2013]/g, '-').replace(/[$,\s+]/g, '');
  const neg = /^\(.*\)$/.test(t);
  if (neg) t = t.slice(1, -1);
  if (!/^-?\d*\.?\d+$/.test(t)) return null;
  return parseFloat(t) * (neg ? -1 : 1);
}

export function signed(v) {
  const n = Math.round(v);
  if (n === 0) return '0';
  return (n > 0 ? '+' : MINUS) + Math.abs(n).toLocaleString('en-US');
}

export function tone(v) {
  return v > 0 ? 'pos' : v < 0 ? 'neg' : 'zero';
}

export function money(v) {
  return '$' + Number(v).toLocaleString('en-US');
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// A name that already ends in "." would otherwise print two periods.
export function endSentence(s) {
  return /[.!?]$/.test(s) ? s : `${s}.`;
}

export function nameKey(s) {
  return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function searchKey(s) {
  return nameKey(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
