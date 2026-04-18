'use strict';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const fs = require('fs');
const path = require('path');

const tmpFile = path.join(os.tmpdir(), `water-bot-handler-test-${process.pid}.json`);
process.env.INTAKE_FILE       = tmpFile;
process.env.DAILY_GOAL_LITERS = '2.0';
process.env.DRINK_SIZE_ML     = '250';
process.env.ESCALATE_AFTER_MINUTES = '10';

const { handle, ratingEmoji, fmt } = require('../handler');
const tracker  = require('../tracker');
const escalation = require('../escalation');
escalation.init(() => Promise.resolve()); // no-op sender

function resetData() {
  try { fs.unlinkSync(tmpFile); } catch { /* not present */ }
  escalation.cancelCycle();
}

before(resetData);
after(resetData);
beforeEach(resetData);

// --- yes / drink logging ---

test('"yes" logs 0.25 L and returns confirmation', async () => {
  const reply = await handle('yes');
  assert.match(reply, /logged 0\.25L/);
  assert.match(reply, /0\.25\/2L/);
  assert.equal(tracker.getStatus().liters, 0.25);
});

test('"drank" is treated as yes', async () => {
  const reply = await handle('drank');
  assert.match(reply, /logged/);
});

test('"Yeah" (mixed case) is treated as yes', async () => {
  const reply = await handle('Yeah');
  assert.match(reply, /logged/);
});

test('multiple drinks accumulate', async () => {
  await handle('yes');
  await handle('yes');
  const reply = await handle('yes');
  assert.match(reply, /0\.75\/2L/);
});

// --- skip ---

test('"skip" acknowledges without logging a drink', async () => {
  const reply = await handle('skip');
  assert.match(reply, /skipping/);
  assert.equal(tracker.getStatus().liters, 0);
  assert.equal(tracker.getStatus().skips, 1);
});

// --- status ---

test('"status" shows current liters and goal', async () => {
  tracker.logDrink();
  const reply = await handle('status');
  assert.match(reply, /0\.25\/2L/);
  assert.match(reply, /\d+%/);
});

// --- goal command ---

test('"goal 1.5" updates goal to 1.5 L', async () => {
  const reply = await handle('goal 1.5');
  assert.match(reply, /1\.5L/);
  assert.equal(tracker.getStatus().goal, 1.5);
});

test('"goal 0" is rejected as out of range', async () => {
  const reply = await handle('goal 0');
  assert.match(reply, /between/);
});

test('"goal 20" is rejected as out of range', async () => {
  const reply = await handle('goal 20');
  assert.match(reply, /between/);
});

// --- stop / resume ---

test('"stop" pauses reminders', async () => {
  const reply = await handle('stop');
  assert.match(reply, /paused/);
  assert.equal(tracker.isPaused(), true);
});

test('"resume" clears a pause', async () => {
  tracker.setPausedUntil(new Date(Date.now() + 60_000).toISOString());
  const reply = await handle('resume');
  assert.match(reply, /resumed/);
  assert.equal(tracker.isPaused(), false);
});

// --- help ---

test('"help" lists all commands', async () => {
  const reply = await handle('help');
  assert.match(reply, /commands/i);
  assert.match(reply, /goal/);
});

// --- unrecognized input ---

test('unrecognized message returns null', async () => {
  const reply = await handle('random nonsense xyz');
  assert.equal(reply, null);
});

// --- ratingEmoji ---

test('ratingEmoji at 100 % returns crushed-it', () => {
  assert.match(ratingEmoji(2, 2), /crushed/);
});

test('ratingEmoji at 75 % returns solid', () => {
  assert.match(ratingEmoji(1.5, 2), /solid/);
});

test('ratingEmoji at 50 % returns halfway', () => {
  assert.match(ratingEmoji(1, 2), /halfway/);
});

test('ratingEmoji below 50 % returns rough', () => {
  assert.match(ratingEmoji(0.5, 2), /rough/);
});

// --- fmt helper ---

test('fmt removes trailing zeros', () => {
  assert.equal(fmt(1.00), 1);
  assert.equal(fmt(0.50), 0.5);
  assert.equal(fmt(0.25), 0.25);
});
