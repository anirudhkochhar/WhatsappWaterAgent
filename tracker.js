'use strict';

const fs = require('fs');
const path = require('path');

// Allow tests to redirect to a temp file via INTAKE_FILE env var
const DATA_FILE = process.env.INTAKE_FILE || path.join(__dirname, 'data', 'intake.json');

function drinkSizeL() {
  return parseInt(process.env.DRINK_SIZE_ML || '250', 10) / 1000;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function load() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    // Reset if it's a new day
    if (data.date !== todayStr()) {
      return fresh();
    }
    // Migrate old glass-based data to liters
    if (data.liters === undefined && data.glasses !== undefined) {
      data.liters = Math.round(data.glasses * drinkSizeL() * 1000) / 1000;
      data.goal = parseFloat(process.env.DAILY_GOAL_LITERS || '2.0');
      delete data.glasses;
      save(data);
    }
    return data;
  } catch {
    return fresh();
  }
}

function fresh() {
  const goal = parseFloat(process.env.DAILY_GOAL_LITERS || '2.0');
  return {
    date: todayStr(),
    liters: 0,
    skips: 0,
    goal,
    paused_until: null,
    events: [],
  };
}

function save(data) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function logDrink() {
  const data = load();
  const amt = drinkSizeL();
  // Keep to ml precision to avoid floating-point drift
  data.liters = Math.round((data.liters + amt) * 1000) / 1000;
  data.events.push({ type: 'drink', time: new Date().toISOString() });
  save(data);
  return data;
}

function logSkip() {
  const data = load();
  data.skips += 1;
  data.events.push({ type: 'skip', time: new Date().toISOString() });
  save(data);
  return data;
}

function getStatus() {
  return load();
}

function setGoal(liters) {
  const data = load();
  data.goal = liters;
  save(data);
  return data;
}

function setPausedUntil(isoString) {
  const data = load();
  data.paused_until = isoString;
  save(data);
}

function clearPause() {
  const data = load();
  data.paused_until = null;
  save(data);
}

function isPaused() {
  const data = load();
  if (!data.paused_until) return false;
  return new Date() < new Date(data.paused_until);
}

module.exports = { logDrink, logSkip, getStatus, setGoal, setPausedUntil, clearPause, isPaused, drinkSizeL };
