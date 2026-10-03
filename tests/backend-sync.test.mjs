import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ledger, schedule } from '../content/club.js';

// The website and the Apps Script each carry the term and the class-year list. These tests make
// a mismatch fail loudly instead of surfacing as "Pick your class year." for a freshman.
const code = readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');

test('Code.gs TERM matches the website term', () => {
  const m = code.match(/^var TERM = "([^"]+)";/m);
  assert.ok(m, 'TERM not found in Code.gs');
  assert.equal(m[1], schedule.term);
  assert.equal(ledger.term, schedule.term);
});

test('Code.gs YEARS matches the join form', () => {
  const m = code.match(/^var YEARS = (\[[^\]]*\]);/m);
  assert.ok(m, 'YEARS not found in Code.gs');
  assert.deepEqual(JSON.parse(m[1]), ledger.years);
});
