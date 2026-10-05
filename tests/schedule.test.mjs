import test from 'node:test';
import assert from 'node:assert/strict';
import { chicagoNow, formatClock, formatDay, formatTimeRange, isOver, nextMeeting } from '../lib/schedule.js';

test('formatClock shows Chicago time and ignores junk', () => {
  assert.equal(formatClock('2026-10-09T23:42:00.000Z'), '6:42 PM');
  assert.equal(formatClock('2026-12-04T23:42:00.000Z'), '5:42 PM');
  assert.equal(formatClock('not a time'), '');
});

const meetings = [
  { date: '2026-10-09', start: '18:00', end: '20:00' },
  { date: '2026-10-22', start: '17:45', end: '20:15', event: true },
  { date: '2026-10-16', start: '18:00', end: '20:00' },
];

test('formats days without shifting across midnight', () => {
  assert.equal(formatDay('2026-10-09'), 'Friday, October 9');
  assert.equal(formatDay('2026-11-08'), 'Sunday, November 8');
});

test('formats time ranges like the deck', () => {
  assert.equal(formatTimeRange('18:00', '20:00'), '6:00 to 8:00 PM');
  assert.equal(formatTimeRange('17:45', '20:15'), '5:45 to 8:15 PM');
  assert.equal(formatTimeRange('10:30', '13:30'), '10:30 AM to 1:30 PM');
});

test('chicagoNow converts from UTC', () => {
  // 2026-10-10 01:30 UTC is 2026-10-09 20:30 in Chicago (CDT, UTC-5).
  assert.equal(chicagoNow(new Date('2026-10-10T01:30:00Z')), '2026-10-09T20:30');
});

test('next meeting is the first one not yet over, in date order', () => {
  assert.equal(nextMeeting(meetings, '2026-10-01T12:00').date, '2026-10-09');
  assert.equal(nextMeeting(meetings, '2026-10-09T19:59').date, '2026-10-09');
  assert.equal(nextMeeting(meetings, '2026-10-09T20:00').date, '2026-10-16');
  assert.equal(nextMeeting(meetings, '2026-10-30T00:00'), null);
});

test('isOver flips at the end time', () => {
  assert.equal(isOver(meetings[0], '2026-10-09T19:59'), false);
  assert.equal(isOver(meetings[0], '2026-10-09T20:00'), true);
});
