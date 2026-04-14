'use strict';

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const MY_NUMBER = process.env.MY_PHONE_NUMBER;
if (!MY_NUMBER || MY_NUMBER.includes('xxxxxxxx')) {
  console.error('[whatsapp] Set MY_PHONE_NUMBER in .env (e.g. +4917123456789)');
  process.exit(1);
}

const MY_CHAT_ID = MY_NUMBER.replace(/^\+/, '') + '@c.us';

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
  puppeteer: {
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

let _onMessage = null;

async function send(text) {
  try {
    await client.sendMessage(MY_CHAT_ID, text);
  } catch (err) {
    console.error('[whatsapp] send error:', err.message);
  }
}

function onMessage(fn) {
  _onMessage = fn;
}

function init() {
  return new Promise((resolve, reject) => {
    client.on('qr', (qr) => {
      console.log('\n[whatsapp] Scan this QR code with WhatsApp:\n');
      qrcode.generate(qr, { small: true });
    });

    client.on('authenticated', () => {
      console.log('[whatsapp] Authenticated — session saved.');
    });

    client.on('ready', () => {
      console.log('[whatsapp] Client ready.');

      // Handle replies sent to yourself (self-chat)
      client.on('message_create', async (msg) => {
        if (!msg.fromMe) return;
        if (msg.from !== MY_CHAT_ID) return;
        console.log(`[whatsapp] incoming: ${JSON.stringify(msg.body)}`);
        if (_onMessage) await _onMessage(msg.body);
      });

      resolve({ send });
    });

    client.on('auth_failure', (msg) => {
      console.error('[whatsapp] Auth failed:', msg);
      reject(new Error(msg));
    });

    client.on('disconnected', (reason) => {
      console.warn('[whatsapp] Disconnected:', reason);
    });

    client.initialize();
  });
}

module.exports = { init, send, onMessage };
