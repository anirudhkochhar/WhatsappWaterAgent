'use strict';

const { Telegraf } = require('telegraf');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OWNER_ID = process.env.TELEGRAM_CHAT_ID ? parseInt(process.env.TELEGRAM_CHAT_ID, 10) : null;

if (!TOKEN) {
  console.error('[telegram] Set TELEGRAM_BOT_TOKEN in .env');
  process.exit(1);
}

const bot = new Telegraf(TOKEN);
let _onMessage = null;

async function send(text) {
  if (!OWNER_ID) {
    console.error('[telegram] TELEGRAM_CHAT_ID not set — cannot send message');
    return;
  }
  try {
    // Use MarkdownV2 formatting — escape special chars for plain messages
    await bot.telegram.sendMessage(OWNER_ID, text, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('[telegram] send error:', err.message);
  }
}

function onMessage(fn) {
  _onMessage = fn;
}

function init() {
  return new Promise((resolve, reject) => {
    // Only handle messages from the owner
    bot.on('text', async (ctx) => {
      const fromId = ctx.from.id;

      // First-time setup helper: print chat ID if not configured
      if (!OWNER_ID) {
        console.log(`[telegram] Message from chat ID: ${fromId} — set this as TELEGRAM_CHAT_ID in .env`);
        await ctx.reply(`Your chat ID is: ${fromId}\nSet TELEGRAM_CHAT_ID=${fromId} in .env and restart.`);
        return;
      }

      if (fromId !== OWNER_ID) return; // ignore anyone else

      console.log(`[telegram] incoming: ${JSON.stringify(ctx.message.text)}`);
      if (_onMessage) await _onMessage(ctx.message.text);
    });

    bot.launch()
      .then(() => {
        console.log('[telegram] Bot connected.');
        resolve({ send });
      })
      .catch(reject);

    // Graceful shutdown
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  });
}

module.exports = { init, send, onMessage };
