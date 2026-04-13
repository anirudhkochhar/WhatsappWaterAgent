'use strict';

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'intake.json');

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
    return data;
  } catch {
    return fresh();
  }
}

function fresh() {
  const goal = parseInt(process.env.DAILY_GOAL_GLASSES || '8', 10);
  return {
    date: todayStr(),
    glasses: 0,
    skips: 0,
    goal,
    paused_until: null,
    events: [],
  };
}

function save(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function logDrink() {
  const data = load();
  data.glasses += 1;
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

function setGoal(glasses) {
  const data = load();
  data.goal = glasses;
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

module.exports = { logDrink, logSkip, getStatus, setGoal, setPausedUntil, clearPause, isPaused };
