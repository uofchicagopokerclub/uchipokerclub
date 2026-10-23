import test from 'node:test';
import assert from 'node:assert/strict';
import { standingsProps } from '../lib/api.js';

// Never the real Sheet: every test replaces fetch.
const URL = 'http://ledger.invalid/exec';
process.env.NEXT_PUBLIC_LEDGER_API_URL = URL;
const realFetch = globalThis.fetch;

const feed = { term: 'Fall 2026', weeks: ['Oct 9'], players: [{ name: 'Ava', results: [500] }] };
const answers = (res) => { globalThis.fetch = async () => res; };
const hangsUp = () => { globalThis.fetch = async () => { throw new Error('timeout'); }; };

test.afterEach(() => {
  delete process.env.NEXT_PHASE;
  delete process.env.NODE_ENV;
  process.env.NEXT_PUBLIC_LEDGER_API_URL = URL;
  globalThis.fetch = realFetch;
});

test('a refresh that reaches the Sheet returns its standings', async () => {
  answers({ ok: true, json: async () => feed });
  assert.deepEqual(await standingsProps(), { feed, connected: true });
});

test('a refresh that cannot reach the Sheet throws, so Next keeps the last good page', async () => {
  hangsUp();
  await assert.rejects(standingsProps());
  answers({ ok: false, status: 500, json: async () => ({}) });
  await assert.rejects(standingsProps());
  answers({ ok: true, json: async () => { throw new SyntaxError('Sorry, unable to open the file'); } });
  await assert.rejects(standingsProps());
});

test('the build renders the empty state instead of failing when the Sheet is down', async () => {
  process.env.NEXT_PHASE = 'phase-production-build';
  hangsUp();
  assert.deepEqual(await standingsProps(), { feed: null, connected: true });
});

test('next dev keeps the empty state, since it has no earlier page to keep', async () => {
  process.env.NODE_ENV = 'development';
  hangsUp();
  assert.deepEqual(await standingsProps(), { feed: null, connected: true });
});
