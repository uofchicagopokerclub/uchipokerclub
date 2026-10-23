import { ledger } from '../content/club.js';
import { cleanFeed } from './ledger.js';

// NEXT_PUBLIC_LEDGER_API_URL overrides the content file, for local testing against the emulator.
export function ledgerApiUrl() {
  return process.env.NEXT_PUBLIC_LEDGER_API_URL || ledger.apiUrl || '';
}

// Next's name for `next build` (PHASE_PRODUCTION_BUILD in next/constants, not imported because this file also
// ships to the browser).
const BUILD_PHASE = 'phase-production-build';

// Props for a page's getStaticProps. When a background refresh cannot reach the Sheet, this throws, and Next keeps
// serving the last good page and tries again on the next visit, instead of swapping the standings for placeholders.
// At build time there is no earlier page to keep, so the page renders its empty state and the browser fetches the
// standings itself rather than the build failing. `next dev` renders every visit fresh, so it keeps the empty state.
export async function standingsProps() {
  const connected = Boolean(ledgerApiUrl());
  const feed = await fetchStandings();
  const refreshing = process.env.NEXT_PHASE !== BUILD_PHASE && process.env.NODE_ENV !== 'development';
  if (connected && !feed && refreshing) {
    throw new Error('Could not reach the ledger; keeping the last good page.');
  }
  return { feed, connected };
}

// Server side. Never throws: null when the Sheet is slow (8 seconds), down, or answers with an error page.
export async function fetchStandings() {
  const url = ledgerApiUrl();
  if (!url) return null;
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return cleanFeed(await res.json());
  } catch {
    return null;
  }
}

// Google sometimes takes most of a minute to answer. The public forms stop waiting after a minute and keep what was
// typed. Sending one again is safe: the backend recognizes a sign-up or a logged count it already has (a sponsor
// inquiry sent twice is saved twice). The board tool passes timeout 0 and waits for every answer, because it updates
// its screen from each one, and a guess would leave it out of step with the Sheet.
const TIMEOUT_MS = 60000;
const TOO_SLOW = 'No answer after a minute. Try again.';

// Browser side. The body is JSON sent as text/plain, which keeps it a "simple" request that
// Apps Script accepts from another site without a preflight.
export async function postToLedger(payload, { timeout = TIMEOUT_MS } = {}) {
  const url = ledgerApiUrl();
  if (!url) throw new Error('The ledger is not connected yet. Ask a board member.');
  // Phones older than iOS 16 lack AbortSignal.timeout; they simply wait.
  const signal = timeout && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(timeout) : undefined;
  const failed = (message) => new Error(signal?.aborted ? TOO_SLOW : message);
  let res;
  try {
    res = await fetch(url, { method: 'POST', body: JSON.stringify(payload), signal });
  } catch {
    throw failed('Could not reach the ledger. Check your connection and try again.');
  }
  if (!res.ok) throw new Error(`The ledger did not respond (HTTP ${res.status}). Try again in a minute.`);
  try {
    return await res.json();
  } catch {
    // Apps Script answers with an HTML error page when it hits a quota or crashes.
    throw failed('The ledger is having trouble right now. Try again in a minute.');
  }
}

export async function getStandingsInBrowser() {
  const url = ledgerApiUrl();
  if (!url) return null;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return cleanFeed(await res.json());
}
