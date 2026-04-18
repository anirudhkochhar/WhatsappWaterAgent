'use strict';

const cron = require('node-cron');
const tracker = require('./tracker');
const escalation = require('./escalation');
const { ratingEmoji, fmt } = require('./handler');

let _sendFn = null;

function send(text) {
  if (_sendFn) return _sendFn(text);
}

// Parse "HH:MM" into { hour, minute }
function parseTime(str) {
  const [h, m] = (str || '').split(':').map(Number);
  return { hour: isNaN(h) ? null : h, minute: isNaN(m) ? 0 : m };
}

// Returns true if current system time falls in the quiet window.
// Accepts an optional `now` Date for testability.
function isQuietHours(now = new Date()) {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const start = parseTime(process.env.QUIET_HOURS_START || '23:00');
  const end = parseTime(process.env.QUIET_HOURS_END || '08:00');

  const startMin = start.hour * 60 + start.minute;
  const endMin = end.hour * 60 + end.minute;

  // Quiet window spans midnight (e.g. 23:00 → 08:00)
  if (startMin > endMin) {
    return currentMinutes >= startMin || currentMinutes < endMin;
  }
  return currentMinutes >= startMin && currentMinutes < endMin;
}

// Returns true if the user is at or ahead of the expected pace for their daily goal.
// When true, the hourly reminder is skipped — no need to nag someone who's on track.
// Accepts an optional `now` Date for testability.
function isAheadOfPace(now = new Date()) {
  const data = tracker.getStatus();
  if (data.liters <= 0 && data.goal <= 0) return false;

  const quietEndParsed  = parseTime(process.env.QUIET_HOURS_END   || '08:00');
  const quietStartParsed = parseTime(process.env.QUIET_HOURS_START || '23:00');

  const activeStartMin = quietEndParsed.hour * 60 + quietEndParsed.minute;   // e.g. 480 (08:00)
  const activeEndMin   = quietStartParsed.hour * 60 + quietStartParsed.minute; // e.g. 1410 (23:30)

  // Only handle the normal case: active window is within a single day
  if (activeEndMin <= activeStartMin) return false;

  const totalActiveMin = activeEndMin - activeStartMin;
  const currentMin = now.getHours() * 60 + now.getMinutes();

  // Before active hours start — no context yet, don't skip
  if (currentMin < activeStartMin) return false;

  const elapsedMin = currentMin - activeStartMin;
  const expectedLiters = (elapsedMin / totalActiveMin) * data.goal;

  return data.liters >= expectedLiters;
}

function startReminder() {
  console.log(`[scheduler] reminder tick at ${new Date().toISOString()}`);
  if (isQuietHours()) { console.log('[scheduler] quiet hours — skipping'); return; }
  if (tracker.isPaused()) { console.log('[scheduler] paused — skipping'); return; }
  if (isAheadOfPace()) { console.log('[scheduler] ahead of pace — skipping'); return; }

  send('💧 Water check — have you had water in the last hour? Reply *yes* or *skip*');
  escalation.startCycle();
  console.log('[scheduler] reminder sent');
}

function startDailySummary() {
  const data = tracker.getStatus();
  const rating = ratingEmoji(data.liters, data.goal);
  send(`📊 Today: you logged ${fmt(data.liters)}L. Goal was ${fmt(data.goal)}L. ${rating}.`);
}

function init(sendFn) {
  _sendFn = sendFn;

  const intervalMin = parseInt(process.env.REMINDER_INTERVAL_MINUTES || '60', 10);

  // Reminder cron: every N minutes
  const reminderCron = `*/${intervalMin} * * * *`;
  cron.schedule(reminderCron, startReminder);

  // Daily summary cron
  const { hour, minute } = parseTime(process.env.SUMMARY_TIME || '20:00');
  const summaryCron = `${minute} ${hour} * * *`;
  cron.schedule(summaryCron, startDailySummary);

  console.log(`[scheduler] reminders every ${intervalMin} min | summary at ${process.env.SUMMARY_TIME || '20:00'}`);
}

module.exports = { init, isQuietHours, isAheadOfPace };
