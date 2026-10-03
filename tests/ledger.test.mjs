import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStandings, parseChips, signed, cleanFeed } from '../lib/ledger.js';

const feed = {
  term: 'Fall 2026',
  weeks: ['Oct 9', 'Oct 16', 'Oct 23'],
  players: [
    { name: 'Ava', results: [5000, null, null] },
    { name: 'Bo', results: [3000, 2000, null] },
    { name: 'Cy', results: [2000, 3000, null] },
    { name: 'Di', results: [null, 4000, null] },
    { name: 'Ed', results: [1000, 500, null] },
    { name: 'Fy', results: [500, 0, null] },
    { name: 'Gu', results: [0, 500, null] },
    { name: 'Never', results: [null, null, null] },
  ],
};

test('ranks by total with shared ranks for ties', () => {
  const s = computeStandings(feed);
  assert.equal(s.latest, 1);
  assert.deepEqual(s.players.map((p) => [p.name, p.rank, p.tied]), [
    ['Ava', 1, true], ['Bo', 1, true], ['Cy', 1, true], ['Di', 4, false], ['Ed', 5, false], ['Fy', 6, true], ['Gu', 6, true],
  ]);
});

test('players who never played are left off', () => {
  assert.ok(!computeStandings(feed).players.some((p) => p.name === 'Never'));
});

test('movement compares with last week, new players marked new', () => {
  const by = Object.fromEntries(computeStandings(feed).players.map((p) => [p.name, p.move]));
  assert.deepEqual(by, { Ava: 0, Bo: 1, Cy: 2, Di: 'new', Ed: -1, Fy: -1, Gu: 0 });
});

test('no movement shown after only one week', () => {
  const s = computeStandings({ weeks: ['Oct 9'], players: [{ name: 'A', results: [10] }] });
  assert.equal(s.players[0].move, null);
});

test('empty or junk feeds give an empty ledger, never a crash', () => {
  for (const f of [null, undefined, {}, { weeks: 'x' }, { weeks: ['Oct 9'], players: [{ name: 5 }, null, { name: '  ' }] }]) {
    const s = computeStandings(f);
    assert.equal(s.latest, -1);
    assert.deepEqual(s.players, []);
  }
});

test('cleanFeed drops non-numeric results', () => {
  const c = cleanFeed({ weeks: ['a', 'b'], players: [{ name: 'X', results: ['5', Infinity] }] });
  assert.deepEqual(c.players[0].results, [null, null]);
});

test('parseChips reads what people type', () => {
  assert.equal(parseChips('2500'), 2500);
  assert.equal(parseChips('-1,200'), -1200);
  assert.equal(parseChips('$10,500'), 10500);
  assert.equal(parseChips('(300)'), -300);
  assert.equal(parseChips('−450'), -450);
  assert.equal(parseChips('abc'), null);
  assert.equal(parseChips(''), null);
});

test('signed uses a real minus and thousands separators', () => {
  assert.equal(signed(4200), '+4,200');
  assert.equal(signed(-1250), '−1,250');
  assert.equal(signed(0), '0');
});
