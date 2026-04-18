'use strict';

const tracker = require('./tracker');
const escalation = require('./escalation');

// Fuzzy yes/no detection
const YES_WORDS = ['yes', 'y', 'ya', 'yep', 'yup', 'yeah', 'drank', 'done', 'drank it', 'had some', 'had water', 'drunk', 'drank water', 'ok', 'okay', 'sure', 'fine', 'k'];
const SKIP_WORDS = ['skip', 'nah', 'no', 'nope', 'not now', 'later', 'pass'];

function normalize(text) {
  return text.trim().toLowerCase().replace(/[^a-z0-9 .]/g, '');
}

function isYes(text) {
  const n = normalize(text);
  return YES_WORDS.some(w => n === w || n.startsWith(w + ' ') || n.endsWith(' ' + w));
}

function isSkip(text) {
  const n = normalize(text);
  return SKIP_WORDS.some(w => n === w || n.startsWith(w + ' '));
}

function ratingEmoji(liters, goal) {
  const ratio = liters / goal;
  if (ratio >= 1) return '🏆 crushed it';
  if (ratio >= 0.75) return '💪 solid effort';
  if (ratio >= 0.5) return '😐 halfway there';
  return '😬 rough day';
}

// Remove trailing zeros from a rounded float: 1.00 → 1, 0.50 → 0.5, 0.25 → 0.25
function fmt(n) {
  return parseFloat(n.toFixed(2));
}

// Returns reply text or null if the message is not recognized
async function handle(messageText) {
  const raw = messageText.trim();
  const lower = raw.toLowerCase();

  // --- yes / drank ---
  if (isYes(raw)) {
    escalation.cancelCycle();
    const data = tracker.logDrink();
    const amt = tracker.drinkSizeL();
    return `💧 logged ${fmt(amt)}L! that's ${fmt(data.liters)}/${fmt(data.goal)}L today. keep it up.`;
  }

  // --- skip ---
  if (isSkip(raw)) {
    escalation.cancelCycle();
    tracker.logSkip();
    return `ok, skipping this one. i'll remind you again later.`;
  }

  // --- status ---
  if (lower === 'status') {
    const data = tracker.getStatus();
    const pct = Math.round((data.liters / data.goal) * 100);
    return `📊 today: ${fmt(data.liters)}/${fmt(data.goal)}L (${pct}%). skips: ${data.skips}.`;
  }

  // --- goal N ---
  const goalMatch = lower.match(/^goal\s+(\d+(?:\.\d+)?)$/);
  if (goalMatch) {
    const g = parseFloat(goalMatch[1]);
    if (g < 0.5 || g > 10) return 'goal must be between 0.5 and 10 liters.';
    tracker.setGoal(g);
    return `goal updated to ${fmt(g)}L per day. 💪`;
  }

  // --- stop ---
  if (lower === 'stop') {
    const until = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    tracker.setPausedUntil(until);
    escalation.cancelCycle();
    return `reminders paused for 2 hours. send "resume" to start early.`;
  }

  // --- resume ---
  if (lower === 'resume') {
    tracker.clearPause();
    return `reminders resumed. 💧`;
  }

  // --- help ---
  if (lower === 'help') {
    return [
      '*Water Bot commands:*',
      '`yes` / `drank` / `done` — log a drink',
      '`skip` — skip this reminder',
      '`status` — today\'s intake vs goal',
      '`goal 2.0` — set daily goal in liters',
      '`stop` — pause reminders for 2 hours',
      '`resume` — resume reminders early',
      '`help` — this list',
    ].join('\n');
  }

  return null; // unrecognized
}

module.exports = { handle, ratingEmoji, fmt };
