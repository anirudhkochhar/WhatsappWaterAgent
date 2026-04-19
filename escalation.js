'use strict';

const llm = require('./llm');

// Escalation state machine.
// State resets on each new reminder cycle (in-memory only; resets on restart).

let state = {
  active: false,       // true while waiting for a reply
  level: 0,            // 0=waiting, 1=first nudge sent, 2=aggressive nudge sent
  timers: [],          // setTimeout handles so we can cancel on reply
};

let _sendFn = null;    // injected by index.js: (text) => Promise<void>

function init(sendFn) {
  _sendFn = sendFn;
}

function send(text) {
  if (_sendFn) return _sendFn(text);
}

function clearTimers() {
  for (const t of state.timers) clearTimeout(t);
  state.timers = [];
}

// Called when a reminder is sent. Kicks off escalation countdown.
function startCycle() {
  clearTimers();
  state.active = true;
  state.level = 0;

  const escalateAfter = parseInt(process.env.ESCALATE_AFTER_MINUTES || '10', 10) * 60 * 1000;

  // Level 1: first nudge after ESCALATE_AFTER_MINUTES
  const t1 = setTimeout(async () => {
    if (!state.active) return;
    state.level = 1;
    const msg1 = await llm.generateMessage('escalation', { level: 1 }) || 'hey. water. now.';
    await send(msg1);

    // Level 2: aggressive nudge after another ESCALATE_AFTER_MINUTES
    const t2 = setTimeout(async () => {
      if (!state.active) return;
      state.level = 2;
      const msg2 = await llm.generateMessage('escalation', { level: 2 })
        || 'you have been ignoring me for 20 minutes. drink water or i will keep texting you.';
      await send(msg2);

      // Level 3+: repeat every 5 minutes until reply
      function nag() {
        if (!state.active) return;
        send('still waiting. drink. water. now. 💧').then(() => {
          const t = setTimeout(nag, 5 * 60 * 1000);
          state.timers.push(t);
        });
      }
      const t3 = setTimeout(nag, 5 * 60 * 1000);
      state.timers.push(t3);
    }, escalateAfter);

    state.timers.push(t2);
  }, escalateAfter);

  state.timers.push(t1);
}

// Called when the user replies (yes, skip, or any command). Cancels escalation.
function cancelCycle() {
  clearTimers();
  state.active = false;
  state.level = 0;
}

function isActive() {
  return state.active;
}

module.exports = { init, startCycle, cancelCycle, isActive };
