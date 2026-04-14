'use strict';

require('dotenv').config();

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const escalation = require('./escalation');
const scheduler = require('./scheduler');
const { handle } = require('./handler');

const MY_NUMBER = process.env.MY_PHONE_NUMBER;
if (!MY_NUMBER || MY_NUMBER.includes('xxxxxxxx')) {
  console.error('[error] Set MY_PHONE_NUMBER in .env (e.g. +4917123456789)');
  process.exit(1);
}

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
  puppeteer: {
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

// Format phone number to WhatsApp chat ID (strip leading + and add @c.us)
function toChatId(phone) {
  return phone.replace(/^\+/, '') + '@c.us';
}

const MY_CHAT_ID = toChatId(MY_NUMBER);

async function send(text) {
  try {
    await client.sendMessage(MY_CHAT_ID, text);
  } catch (err) {
    console.error('[send error]', err.message);
  }
}

// QR code for first-time auth
client.on('qr', (qr) => {
  console.log('\n[auth] Scan this QR code with WhatsApp:\n');
  qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
  console.log('[whatsapp] Client ready. Bot is running.');
  escalation.init(send);
  scheduler.init(send);
  const data = require('./tracker').getStatus();
  await send(`✅ Water bot started. Reminders every ${process.env.REMINDER_INTERVAL_MINUTES || 60} min. Today: ${data.glasses}/${data.goal} glasses so far.`);
});

client.on('authenticated', () => {
  console.log('[whatsapp] Authenticated — session saved, no re-scan needed.');
});

client.on('auth_failure', (msg) => {
  console.error('[whatsapp] Auth failed:', msg);
  process.exit(1);
});

client.on('disconnected', (reason) => {
  console.warn('[whatsapp] Disconnected:', reason);
});

// Only handle messages from yourself
client.on('message', async (msg) => {
  // Ignore messages not from our own number
  const from = msg.from;
  if (from !== MY_CHAT_ID) return;

  const reply = await handle(msg.body, send);
  if (reply) {
    await send(reply);
  }
});

client.initialize();
