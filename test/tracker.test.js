'use strict';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const fs = require('fs');
const path = require('path');

// Point tracker at a temp file — must be set before requiring tracker
const tmpFile = path.join(os.tmpdir(), `water-bot-tracker-test-${process.pid}.json`);
process.env.INTAKE_FILE      = tmpFile;
process.env.DAILY_GOAL_LITERS = '2.0';
process.env.DRINK_SIZE_ML    = '250';

const tracker = require('../tracker');

function resetData() {
  try { fs.unlinkSync(tmpFile); } catch { /* not present */ }
}

before(resetData);
after(resetData);
beforeEach(resetData);

test('fresh state has zero liters and correct goal', () => {
  const data = tracker.getStatus();
  assert.equal(data.liters, 0);
  assert.equal(data.goal, 2.0);
  assert.equal(data.skips, 0);
});

test('logDrink adds 0.25 L (250 ml)', () => {
  const data = tracker.logDrink();
  assert.equal(data.liters, 0.25);
});

test('logDrink accumulates without floating-point drift', () => {
  tracker.logDrink();
  tracker.logDrink();
  const data = tracker.logDrink();
  assert.equal(data.liters, 0.75);
});

test('logDrink records an event', () => {
  const data = tracker.logDrink();
  assert.equal(data.events.length, 1);
  assert.equal(data.events[0].type, 'drink');
});

test('logSkip increments skips and records an event', () => {
  tracker.logSkip();
  const data = tracker.getStatus();
  assert.equal(data.skips, 1);
  assert.equal(data.events[0].type, 'skip');
});

test('setGoal persists the new goal', () => {
  tracker.setGoal(1.5);
  const data = tracker.getStatus();
  assert.equal(data.goal, 1.5);
});

test('isPaused returns false when not paused', () => {
  assert.equal(tracker.isPaused(), false);
});

test('isPaused returns true when paused until the future', () => {
  tracker.setPausedUntil(new Date(Date.now() + 60_000).toISOString());
  assert.equal(tracker.isPaused(), true);
});

test('isPaused returns false after pause has expired', () => {
  tracker.setPausedUntil(new Date(Date.now() - 60_000).toISOString());
  assert.equal(tracker.isPaused(), false);
});

test('clearPause removes an active pause', () => {
  tracker.setPausedUntil(new Date(Date.now() + 60_000).toISOString());
  tracker.clearPause();
  assert.equal(tracker.isPaused(), false);
});

test('drinkSizeL reflects DRINK_SIZE_ML env var', () => {
  assert.equal(tracker.drinkSizeL(), 0.25);
});
