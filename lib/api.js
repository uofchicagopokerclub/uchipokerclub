import { ledger } from '../content/club';
import { cleanFeed } from './ledger';

// NEXT_PUBLIC_LEDGER_API_URL overrides the content file, for local testing against the emulator.
export function ledgerApiUrl() {
  return process.env.NEXT_PUBLIC_LEDGER_API_URL || ledger.apiUrl || '';
}

// Server side, during static generation. Never throws: a slow or broken Sheet means the page
// renders its empty state and the browser tries again, instead of failing the build.
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

// Browser side. The body is JSON sent as text/plain, which keeps it a "simple" request that
// Apps Script accepts from another site without a preflight.
export async function postToLedger(payload) {
  const url = ledgerApiUrl();
  if (!url) throw new Error('The ledger is not connected yet. Ask a board member.');
  let res;
  try {
    res = await fetch(url, { method: 'POST', body: JSON.stringify(payload) });
  } catch {
    throw new Error('Could not reach the ledger. Check your connection and try again.');
  }
  if (!res.ok) throw new Error(`The ledger did not respond (HTTP ${res.status}). Try again in a minute.`);
  try {
    return await res.json();
  } catch {
    // Apps Script answers with an HTML error page when it hits a quota or crashes.
    throw new Error('The ledger is having trouble right now. Try again in a minute.');
  }
}

export async function getStandingsInBrowser() {
  const url = ledgerApiUrl();
  if (!url) return null;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return cleanFeed(await res.json());
}
