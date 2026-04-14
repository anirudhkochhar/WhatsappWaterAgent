# Water Reminder Bot

A bot that messages you on a schedule to drink water. If you don't reply, it escalates. Built for ADHD — hard to ignore, not easy to dismiss.

Supports two platforms — pick the one that works for you:

| Platform | Pros | Cons |
|---|---|---|
| **Telegram** | Real push notifications, no extra hardware, simpler setup | Requires Telegram |
| **WhatsApp** | Uses your existing WhatsApp | Messages arrive silently (no push notification in self-chat) |

---

## Requirements

- Node.js 18+

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure `.env`

Copy the example and edit:

```bash
cp .env.example .env
```

Set `PLATFORM` to either `telegram` or `whatsapp`, then fill in the relevant section below.

---

## Platform setup

### Telegram (recommended)

Telegram sends real push notifications and requires no extra hardware or Puppeteer.

**Step 1 — Create a bot**

1. Open Telegram and message `@BotFather`
2. Send `/newbot` and follow the prompts
3. Copy the token it gives you

**Step 2 — Configure `.env`**

```
PLATFORM=telegram
TELEGRAM_BOT_TOKEN=123456:ABCdef...
TELEGRAM_CHAT_ID=                   # leave blank for now
```

**Step 3 — Find your chat ID**

Start the bot, then send any message to your bot on Telegram. It will reply:

> Your chat ID is: 123456789
> Set TELEGRAM_CHAT_ID=123456789 in .env and restart.

Add that to `.env` and restart.

---

### WhatsApp

> **Note:** WhatsApp does not send push notifications for messages in self-chat (Saved Messages). You will see the message when you open the app, but your phone will not buzz. If push notifications matter, use Telegram.

Requires Chromium on your system (used by Puppeteer under the hood).

**Configure `.env`**

```
PLATFORM=whatsapp
MY_PHONE_NUMBER=+4917123456789
PUPPETEER_EXECUTABLE_PATH=          # leave blank on Mac/Windows
                                    # set to /usr/bin/chromium-browser on Raspberry Pi / Linux
```

**First run — scan QR code**

```bash
node index.js
```

A QR code prints in the terminal. Open WhatsApp → **Linked Devices** → **Link a Device** → scan it. The session is saved to `.wwebjs_auth/` so you only need to scan once.

---

## Shared config

These settings apply regardless of platform:

```
REMINDER_INTERVAL_MINUTES=60    # How often to send reminders
ESCALATE_AFTER_MINUTES=10       # Wait before first escalation
DAILY_GOAL_GLASSES=8            # Target glasses per day
SUMMARY_TIME=20:00              # When to send daily summary (24h)
QUIET_HOURS_START=23:00         # No reminders after this time
QUIET_HOURS_END=08:00           # No reminders before this time
```

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

At your configured `SUMMARY_TIME`:

> 📊 Today: you logged 6 glasses. Goal was 8. 💪 solid effort.

---

## Commands

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

A Raspberry Pi is ideal for running the bot continuously at low power. Pi 3 or 4 recommended (1GB+ RAM if using WhatsApp/Puppeteer; any model works for Telegram).

### 1. Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2. Install Chromium (WhatsApp only)

```bash
sudo apt install -y chromium-browser
```

Skip this step if using Telegram.

### 3. Clone and configure

```bash
git clone https://github.com/you/your-repo.git
cd your-repo
npm install
cp .env.example .env
nano .env
```

### 4. Set the correct timezone

Quiet hours and the daily summary use local system time:

```bash
sudo raspi-config   # → Localisation → Timezone
```

### 5. Keep it running with pm2

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

---

## Running persistently on Mac/Windows (optional)

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
- The bot only responds to messages from your configured account; all other messages are ignored.
- `.env` and `data/intake.json` are gitignored to keep your credentials and data private.
- **WhatsApp session expiry:** if your phone has no internet for an extended period, WhatsApp may terminate the linked device session. SSH into the Pi and run `node index.js` briefly to re-scan.
