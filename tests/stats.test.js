'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/shared/stats');
const { normalize, DEFAULT_SETTINGS } = require('../src/main/store');

test('dayKey uses local date with zero padding', () => {
  assert.equal(S.dayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

test('lastDays returns oldest first and crosses month boundaries', () => {
  assert.deepEqual(S.lastDays(3, new Date(2026, 2, 1)), ['2026-02-27', '2026-02-28', '2026-03-01']);
});

test('addUsage sums seconds per day, app and hour', () => {
  const days = {};
  S.addUsage(days, '2026-11-06', 'chrome.exe', 20, 30);
  S.addUsage(days, '2026-11-06', 'chrome.exe', 20, 15);
  S.addUsage(days, '2026-11-06', 'chrome.exe', 21, 5);
  assert.equal(days['2026-11-06']['chrome.exe'].s, 50);
  assert.equal(days['2026-11-06']['chrome.exe'].h[20], 45);
  assert.equal(days['2026-11-06']['chrome.exe'].h[21], 5);
});

test('ranking orders apps by time and computes share', () => {
  const days = {};
  S.addUsage(days, 'a', 'code.exe', 10, 300);
  S.addUsage(days, 'a', 'chrome.exe', 10, 100);
  S.addUsage(days, 'b', 'chrome.exe', 10, 400);
  const r = S.ranking(days, ['a', 'b']);
  assert.deepEqual(r.map((x) => x.exe), ['chrome.exe', 'code.exe']);
  assert.equal(r[0].seconds, 500);
  assert.ok(Math.abs(r[0].share - 500 / 800) < 1e-9);
  assert.deepEqual(S.ranking(days, ['missing']), []);
});

test('totals by day and by hour, optionally for one app', () => {
  const days = {};
  S.addUsage(days, 'a', 'x.exe', 1, 10);
  S.addUsage(days, 'a', 'y.exe', 1, 20);
  S.addUsage(days, 'b', 'x.exe', 2, 5);
  assert.deepEqual(S.totalsByDay(days, ['a', 'b', 'c']), [30, 5, 0]);
  assert.deepEqual(S.totalsByDay(days, ['a', 'b'], 'x.exe'), [10, 5]);
  const h = S.totalsByHour(days, ['a', 'b'], 'x.exe');
  assert.equal(h[1], 10);
  assert.equal(h[2], 5);
});

test('level grows with the square root of XP', () => {
  assert.equal(S.level(0).level, 1);
  assert.equal(S.level(15 * 60).level, 2); // 15 XP
  assert.equal(S.level(60 * 60).level, 3); // 60 XP
  const p = S.level(30 * 60).progress;
  assert.ok(p > 0 && p < 1);
});

test('streak counts consecutive days and tolerates an empty today', () => {
  const days = {};
  const today = new Date(2026, 10, 6);
  for (const k of S.lastDays(3, new Date(2026, 10, 5))) S.addUsage(days, k, 'x.exe', 1, 120);
  assert.equal(S.streak(days, today), 3);
  S.addUsage(days, '2026-11-06', 'x.exe', 1, 120);
  assert.equal(S.streak(days, today), 4);
});

test('achievements', () => {
  const days = {};
  S.addUsage(days, 'd', 'game.exe', 1, 3 * 3600);
  const a = S.achievements(days, 'd');
  assert.ok(a.includes('marathoner'));
  assert.ok(a.includes('nightOwl'));
  assert.ok(!a.includes('balanced'));
});

test('mood follows screen time and goal', () => {
  assert.equal(S.mood(30 * 60, 0), 'happy');
  assert.equal(S.mood(3 * 3600, 0), 'focused');
  assert.equal(S.mood(7 * 3600, 0), 'sleepy');
  assert.equal(S.mood(3 * 3600, 2), 'worried');
});

test('formatDuration', () => {
  assert.equal(S.formatDuration(10), '<1min');
  assert.equal(S.formatDuration(125), '2min');
  assert.equal(S.formatDuration(2 * 3600 + 5 * 60), '2h 05min');
});

test('CSV escapes quotes', () => {
  const days = {};
  S.addUsage(days, '2026-11-06', 'a.exe', 1, 90);
  const csv = S.toCsv(days, { 'a.exe': { name: 'My "App"' } });
  assert.match(csv, /2026-11-06,"My ""App""","a.exe",1\.5/);
});

test('store normalize fills defaults and survives bad input', () => {
  assert.deepEqual(normalize(null).settings, DEFAULT_SETTINGS);
  const n = normalize({ settings: { idleMinutes: 5, ignored: 'x' }, days: { a: {} } });
  assert.equal(n.settings.idleMinutes, 5);
  assert.deepEqual(n.settings.ignored, []);
  assert.deepEqual(n.days, { a: {} });
});
