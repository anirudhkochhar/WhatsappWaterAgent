# WhatsApp Water Bot

A WhatsApp bot that texts you on a schedule to drink water. If you don't reply, it escalates. Built for ADHD — hard to ignore, not easy to dismiss.

---

## Requirements

- Node.js 18+
- A WhatsApp account (the bot messages *yourself*)
- Chromium/Chrome available on your system (used by Puppeteer under the hood)

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure `.env`

Edit the `.env` file in the project root:

```
MY_PHONE_NUMBER=+4917123456789      # Your number in international format
REMINDER_INTERVAL_MINUTES=60        # How often to send reminders
ESCALATE_AFTER_MINUTES=10           # Minutes before first escalation
DAILY_GOAL_GLASSES=8                # Target glasses per day
SUMMARY_TIME=20:00                  # When to send daily summary (24h)
QUIET_HOURS_START=23:00             # No reminders after this time
QUIET_HOURS_END=08:00               # No reminders before this time
```

`MY_PHONE_NUMBER` is the only required change — use full international format including the `+`.

### 3. Start the bot

```bash
node index.js
```

On first run, a QR code prints in your terminal. Open WhatsApp on your phone → **Linked Devices** → **Link a Device** → scan the QR code.

The session is saved locally (`.wwebjs_auth/`) so you only need to scan once.

---

## How it works

### Reminder cycle

Every hour (configurable), the bot sends:

> 💧 Water check — have you drunk water in the last hour? Reply **yes** or **skip**

Reply within 10 minutes and the cycle resets. If you don't:

| Time elapsed | Message |
|---|---|
| +10 min | *"hey. water. now."* |
| +20 min | *"you have been ignoring me for 20 minutes. drink water or i will keep texting you."* |
| +25, +30, … | *"still waiting. drink. water. now. 💧"* (every 5 min until you reply) |

### Daily summary

At your configured `SUMMARY_TIME`, you'll get:

> 📊 Today: you logged 6 glasses. Goal was 8. 💪 solid effort.

---

## Commands

Send any of these to the bot (your own number) at any time:

| Message | What it does |
|---|---|
| `yes` / `drank` / `done` | Log one glass, cancel escalation |
| `skip` | Acknowledge without logging, cancel escalation |
| `status` | Show today's count vs goal |
| `goal 8` | Set daily glass goal to 8 |
| `stop` | Pause reminders for 2 hours |
| `resume` | Resume reminders early |
| `help` | List all commands |

Replies are case-insensitive and loosely matched — `ya`, `yep`, `drank it`, `had some` all count as yes.

---

## Running persistently (optional)

To keep the bot alive after closing your terminal, use [pm2](https://pm2.keymetrics.io/):

```bash
npm install -g pm2
pm2 start index.js --name water-bot
pm2 save
pm2 startup   # follow the printed command to auto-start on reboot
```

Useful pm2 commands:

```bash
pm2 logs water-bot    # view live logs
pm2 restart water-bot
pm2 stop water-bot
```

---

## Notes

- Escalation state is in-memory — restarting the bot resets any pending escalation timers.
- Daily intake data persists in `data/intake.json` and resets automatically at midnight.
- The bot only responds to messages from your own number; all other messages are ignored.
- `.env` and `data/intake.json` are gitignored to keep your number and data private.
