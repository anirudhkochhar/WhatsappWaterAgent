'use strict';

require('dotenv').config();

const escalation = require('./escalation');
const scheduler = require('./scheduler');
const tracker = require('./tracker');
const { handle } = require('./handler');

const PLATFORM = (process.env.PLATFORM || 'whatsapp').toLowerCase();
const platform = require(`./platforms/${PLATFORM}`);

console.log(`[boot] Starting water bot on platform: ${PLATFORM}`);

async function main() {
  // Wire up reply handler before init so no messages are missed
  platform.onMessage(async (text) => {
    const reply = await handle(text);
    if (reply) await platform.send(reply);
  });

  await platform.init();

  // Inject send into escalation and scheduler
  escalation.init(platform.send.bind(platform));
  scheduler.init(platform.send.bind(platform));

  // Startup confirmation message
  const data = tracker.getStatus();
  await platform.send(
    `✅ Water bot started (${PLATFORM}). Reminders every ${process.env.REMINDER_INTERVAL_MINUTES || 60} min. Today: ${data.liters}/${data.goal}L so far.`
  );

  console.log('[boot] Ready.');
}

main().catch((err) => {
  console.error('[boot] Fatal error:', err);
  process.exit(1);
});
