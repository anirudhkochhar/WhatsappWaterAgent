'use strict';

const tracker = require('./tracker');
const escalation = require('./escalation');

// Fuzzy yes/no detection
const YES_WORDS = ['yes', 'y', 'ya', 'yep', 'yup', 'yeah', 'drank', 'done', 'drank it', 'had some', 'had water', 'drunk', 'drank water', 'ok', 'okay', 'sure', 'fine', 'k'];
const SKIP_WORDS = ['skip', 'nah', 'no', 'nope', 'not now', 'later', 'pass'];

function normalize(text) {
  return text.trim().toLowerCase().replace(/[^a-z0-9 ]/g, '');
}

function isYes(text) {
  const n = normalize(text);
  return YES_WORDS.some(w => n === w || n.startsWith(w + ' ') || n.endsWith(' ' + w));
}

function isSkip(text) {
  const n = normalize(text);
  return SKIP_WORDS.some(w => n === w || n.startsWith(w + ' '));
}

function ratingEmoji(glasses, goal) {
  const ratio = glasses / goal;
  if (ratio >= 1) return '🏆 crushed it';
  if (ratio >= 0.75) return '💪 solid effort';
  if (ratio >= 0.5) return '😐 halfway there';
  return '😬 rough day';
}

// Returns reply text or null if the message is not from the owner / not recognized
async function handle(messageText, send) {
  const raw = messageText.trim();
  const lower = raw.toLowerCase();

  // --- yes / drank ---
  if (isYes(raw)) {
    escalation.cancelCycle();
    const data = tracker.logDrink();
    return `💧 logged! that's ${data.glasses} glass${data.glasses !== 1 ? 'es' : ''} today (goal: ${data.goal}). keep it up.`;
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
    const pct = Math.round((data.glasses / data.goal) * 100);
    return `📊 today: ${data.glasses}/${data.goal} glasses (${pct}%). skips: ${data.skips}.`;
  }

  // --- goal N ---
  const goalMatch = lower.match(/^goal\s+(\d+)$/);
  if (goalMatch) {
    const g = parseInt(goalMatch[1], 10);
    if (g < 1 || g > 30) return 'goal must be between 1 and 30 glasses.';
    tracker.setGoal(g);
    return `goal updated to ${g} glasses per day. 💪`;
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
      '`yes` / `drank` / `done` — log a glass',
      '`skip` — skip this reminder',
      '`status` — today\'s count vs goal',
      '`goal 8` — set daily goal',
      '`stop` — pause reminders for 2 hours',
      '`resume` — resume reminders early',
      '`help` — this list',
    ].join('\n');
  }

  return null; // unrecognized
}

module.exports = { handle, ratingEmoji };
