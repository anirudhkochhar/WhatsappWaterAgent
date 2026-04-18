'use strict';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const fs = require('fs');
const path = require('path');

const tmpFile = path.join(os.tmpdir(), `water-bot-scheduler-test-${process.pid}.json`);
process.env.INTAKE_FILE        = tmpFile;
process.env.DAILY_GOAL_LITERS  = '2.0';
process.env.DRINK_SIZE_ML      = '250';
process.env.QUIET_HOURS_START  = '23:00';
process.env.QUIET_HOURS_END    = '08:00';

const { isQuietHours, isAheadOfPace } = require('../scheduler');
const tracker = require('../tracker');

function at(hh, mm) {
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  return d;
}

function resetData() {
  try { fs.unlinkSync(tmpFile); } catch { /* not present */ }
}

before(resetData);
after(resetData);
beforeEach(resetData);

// ── isQuietHours ─────────────────────────────────────────────────────────────

test('isQuietHours: midnight is quiet', () => {
  assert.equal(isQuietHours(at(0, 0)), true);
});

test('isQuietHours: 23:30 is quiet', () => {
  assert.equal(isQuietHours(at(23, 30)), true);
});

test('isQuietHours: 07:59 is quiet', () => {
  assert.equal(isQuietHours(at(7, 59)), true);
});

test('isQuietHours: 08:00 is not quiet (active hours start)', () => {
  assert.equal(isQuietHours(at(8, 0)), false);
});

test('isQuietHours: midday is not quiet', () => {
  assert.equal(isQuietHours(at(12, 0)), false);
});

test('isQuietHours: 22:59 is not quiet', () => {
  assert.equal(isQuietHours(at(22, 59)), false);
});

test('isQuietHours: 23:00 is quiet (quiet period starts)', () => {
  assert.equal(isQuietHours(at(23, 0)), true);
});

// ── isAheadOfPace ─────────────────────────────────────────────────────────────
// Active window: 08:00–23:00 = 900 minutes. Goal = 2.0 L.
// Expected at time T = (elapsed_min / 900) * 2.0

test('isAheadOfPace: no drinks, middle of day → not ahead', () => {
  // 0 L drunk, expected > 0 → not ahead
  assert.equal(isAheadOfPace(at(14, 0)), false);
});

test('isAheadOfPace: before active hours start → false (no context)', () => {
  // 07:00 is before 08:00 active start
  assert.equal(isAheadOfPace(at(7, 0)), false);
});

test('isAheadOfPace: at goal by midday → ahead', () => {
  // Drink 2 L (8 drinks) then check at 14:00
  for (let i = 0; i < 8; i++) tracker.logDrink();
  assert.equal(isAheadOfPace(at(14, 0)), true);
});

test('isAheadOfPace: exactly on pace is considered ahead (≥)', () => {
  // At 08:00 elapsed = 0 min → expected = 0 L → 0 L drunk is ahead
  assert.equal(isAheadOfPace(at(8, 0)), true);
});

test('isAheadOfPace: slightly behind pace → not ahead', () => {
  // At 09:00: elapsed = 60 min, expected = (60/900)*2 = 0.133 L
  // 0 L drunk → not ahead
  tracker.logDrink(); // 0.25 L
  // At 14:00: elapsed = 360, expected = (360/900)*2 = 0.8 L → 0.25 < 0.8
  assert.equal(isAheadOfPace(at(14, 0)), false);
});

test('isAheadOfPace: well ahead early in the day → skips reminder', () => {
  // Drink 1.0 L early in the day (09:00)
  for (let i = 0; i < 4; i++) tracker.logDrink(); // 1.0 L
  // At 09:00: elapsed = 60 min, expected = (60/900)*2 = 0.133 L → 1.0 > 0.133 → ahead
  assert.equal(isAheadOfPace(at(9, 0)), true);
});
