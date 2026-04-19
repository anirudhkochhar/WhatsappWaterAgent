'use strict';

const Anthropic = require('@anthropic-ai/sdk');

const TIMEOUT_MS = 5000;
const DEFAULT_MODEL = 'claude-3-haiku-20240307';

let _client = null;

function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

function isEnabled() {
  return !!process.env.ANTHROPIC_API_KEY;
}

function model() {
  return process.env.LLM_MODEL || DEFAULT_MODEL;
}

function withTimeout(promise) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('LLM timeout')), TIMEOUT_MS)),
  ]);
}

// Returns parsed intent object or null on any failure.
// Intent shape: { intent: 'yes'|'skip'|'status'|'goal'|'stop'|'resume'|'help'|'unknown', value?: number }
async function parseIntent(text, context) {
  if (!isEnabled()) return null;
  try {
    const { liters, goal } = context;
    const result = await withTimeout(
      getClient().messages.create({
        model: model(),
        max_tokens: 60,
        system: `You parse replies to a water reminder bot. Current intake: ${liters}L of ${goal}L goal.
Output ONLY valid JSON with an "intent" field. No explanation, no markdown.
Valid intents: "yes" (drank water), "skip" (skipping reminder), "status" (check today's intake), "goal" (set daily goal — add "value" field in liters), "stop" (pause reminders), "resume" (resume reminders), "help" (list commands), "unknown".
Examples: "yeah had some" → {"intent":"yes"} | "not now" → {"intent":"skip"} | "set goal to 3L" → {"intent":"goal","value":3} | "pause" → {"intent":"stop"}`,
        messages: [{ role: 'user', content: text }],
      })
    );
    return JSON.parse(result.content[0].text.trim());
  } catch (err) {
    console.error('[llm] parseIntent failed, falling back to keyword matching:', err.message);
    return null;
  }
}

// Returns a generated message string or null on any failure.
// type: 'reminder' | 'escalation' | 'summary'
async function generateMessage(type, context) {
  if (!isEnabled()) return null;
  try {
    let prompt;
    const { liters, goal } = context;
    const pct = Math.round((liters / goal) * 100);

    if (type === 'reminder') {
      prompt = `Write a short water reminder message. Intake so far: ${liters}L of ${goal}L goal (${pct}%). Time: ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. Be direct and casual — vary the tone (sometimes firm, sometimes light). 1-2 sentences, no sign-off.`;
    } else if (type === 'escalation') {
      prompt = `Write a short escalation message for someone ignoring a water reminder. Level ${context.level} of 2 (2 = most aggressive). Be increasingly firm and annoyed. 1 sentence, no sign-off.`;
    } else if (type === 'summary') {
      prompt = `Write a short end-of-day water intake summary. Drank: ${liters}L, goal: ${goal}L (${pct}%). Rating: "${context.rating}". 1-2 casual sentences, no sign-off.`;
    }

    const result = await withTimeout(
      getClient().messages.create({
        model: model(),
        max_tokens: 80,
        messages: [{ role: 'user', content: prompt }],
      })
    );
    return result.content[0].text.trim();
  } catch (err) {
    console.error(`[llm] generateMessage(${type}) failed, using fallback:`, err.message);
    return null;
  }
}

module.exports = { isEnabled, parseIntent, generateMessage };
