import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { ledger, schedule } from '../content/club.js';
import { MAX_CHIPS } from '../lib/ledger.js';

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

test('Code.gs MAX_CHIPS matches the chip check in the forms', () => {
  const m = code.match(/^var MAX_CHIPS = (\d+);/m);
  assert.ok(m, 'MAX_CHIPS not found in Code.gs');
  assert.equal(Number(m[1]), MAX_CHIPS);
});

// Members can log results only on the night a week column is dated, so each label has to land on a weekly
// meeting in the schedule, or logging stays shut on a real meeting night. This runs the shipped weekDate_.
test('Code.gs week labels fall on the weekly meetings in the schedule', () => {
  const { makeEnv } = createRequire(import.meta.url)('../apps-script/test/gas-mock.cjs');
  const G = makeEnv();
  const dated = [...G.WEEKS].map((label) => G.weekDate_(label)); // spread: arrays from the script's realm
  assert.deepEqual(dated, schedule.meetings.filter((x) => !x.event).map((x) => x.date));
});
