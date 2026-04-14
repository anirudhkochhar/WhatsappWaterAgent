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
PUPPETEER_EXECUTABLE_PATH=          # Path to Chromium — leave blank on Mac/Windows, set on Linux/Raspberry Pi
```

`MY_PHONE_NUMBER` is the only required change — use full international format including the `+`.

On **Raspberry Pi / Linux**, set `PUPPETEER_EXECUTABLE_PATH` to the system Chromium so Puppeteer doesn't try to download its own:

```
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

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

## Running on a Raspberry Pi (24/7)

A Raspberry Pi is ideal for running the bot continuously at low power. Pi 3 or 4 recommended (1GB+ RAM for Puppeteer).

### 1. Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2. Install Chromium

```bash
sudo apt install -y chromium-browser
```

### 3. Clone and configure

```bash
git clone https://github.com/you/your-repo.git
cd your-repo
npm install
cp .env.example .env
nano .env   # fill in your phone number and set PUPPETEER_EXECUTABLE_PATH
```

### 4. Set the correct timezone

Quiet hours and the daily summary use local system time:

```bash
sudo raspi-config   # → Localisation → Timezone
```

### 5. Scan the QR code once

```bash
node index.js
```

Scan with your phone. The session is saved and won't need re-scanning unless it expires.

### 6. Keep it running with pm2

```bash
sudo npm install -g pm2
pm2 start index.js --name water-bot
pm2 save
pm2 startup   # run the command it prints to survive reboots
```

Useful pm2 commands:

```bash
pm2 logs water-bot    # view live logs
pm2 restart water-bot
pm2 stop water-bot
```

> **Session expiry:** if your phone has no internet for an extended period, WhatsApp may terminate the linked device session. SSH into the Pi and run `node index.js` briefly to re-scan the QR code.

---

## Running persistently on Mac/Windows (optional)

Use pm2 the same way — just skip the Chromium install and leave `PUPPETEER_EXECUTABLE_PATH` blank:

```bash
npm install -g pm2
pm2 start index.js --name water-bot
pm2 save
pm2 startup
```

---

## Notes

- Escalation state is in-memory — restarting the bot resets any pending escalation timers.
- Daily intake data persists in `data/intake.json` and resets automatically at midnight.
- The bot only responds to messages from your own number; all other messages are ignored.
- `.env` and `data/intake.json` are gitignored to keep your number and data private.
