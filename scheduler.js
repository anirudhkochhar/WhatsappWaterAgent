'use strict';

const cron = require('node-cron');
const tracker = require('./tracker');
const escalation = require('./escalation');
const { ratingEmoji } = require('./handler');

let _sendFn = null;

function send(text) {
  if (_sendFn) return _sendFn(text);
}

// Parse "HH:MM" into { hour, minute }
function parseTime(str) {
  const [h, m] = (str || '').split(':').map(Number);
  return { hour: isNaN(h) ? null : h, minute: isNaN(m) ? 0 : m };
}

function isQuietHours() {
  const now = new Date();
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

function startReminder() {
  if (isQuietHours()) return;
  if (tracker.isPaused()) return;

  send('💧 Water check — have you drunk water in the last hour? Reply *yes* or *skip*');
  escalation.startCycle();
}

function startDailySummary() {
  const data = tracker.getStatus();
  const rating = ratingEmoji(data.glasses, data.goal);
  send(`📊 Today: you logged ${data.glasses} glass${data.glasses !== 1 ? 'es' : ''}. Goal was ${data.goal}. ${rating}.`);
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

module.exports = { init };
