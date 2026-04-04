// ============================================================
// TELEGRAM ALERT SENDER
// Sends formatted messages to your personal Telegram chat
// ============================================================

import axios from 'axios';

const TELEGRAM_API = 'https://api.telegram.org/bot';

// -----------------------------------------------------------------------
// SEND A TELEGRAM MESSAGE
// -----------------------------------------------------------------------
export async function sendTelegramMessage(message: string): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.warn('[Telegram] Bot token or chat ID not configured — skipping alert');
    return false;
  }

  try {
    const url = `${TELEGRAM_API}${botToken}/sendMessage`;
    await axios.post(url, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }, { timeout: 10000 });

    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Telegram] Failed to send message:', msg);
    return false;
  }
}

// -----------------------------------------------------------------------
// FORMAT ALERT MESSAGES
// -----------------------------------------------------------------------
export function formatEventWarningMessage(
  eventName: string,
  currency: string,
  minutesAway: number,
  tier: number,
  affectedPairs: string[]
): string {
  const tierEmoji = tier === 1 ? '🔴' : '🟡';
  const tierLabel = tier === 1 ? 'HIGH IMPACT' : 'MEDIUM IMPACT';
  const timeStr = minutesAway < 60
    ? `${minutesAway} minutes`
    : `${Math.floor(minutesAway / 60)}h ${minutesAway % 60}m`;

  const pairsStr = affectedPairs.slice(0, 4).join(', ');

  return `${tierEmoji} <b>EVENT RISK — ${tierLabel}</b>

📅 <b>${currency} ${eventName}</b>
⏰ In <b>${timeStr}</b>
💱 Affected: ${pairsStr}

⚠️ Consider avoiding fresh entries on ${currency} pairs before release.`;
}

export function formatBiasFlipMessage(
  currency: string,
  oldBias: string,
  newBias: string,
  score: number,
  explanation: string
): string {
  const arrow = newBias.includes('Bullish') ? '📈' : newBias.includes('Bearish') ? '📉' : '⚖️';
  return `${arrow} <b>BIAS FLIP — ${currency}</b>

<b>${oldBias}</b> → <b>${newBias}</b>
Score: ${score > 0 ? '+' : ''}${score.toFixed(0)}

${explanation.split('\n').slice(0, 3).join('\n')}`;
}

export function formatRegimeChangeMessage(
  oldRegime: string,
  newRegime: string,
  explanation: string
): string {
  const emoji = newRegime === 'Risk-On' ? '🟢' : newRegime === 'Risk-Off' ? '🔴' : '🔄';
  return `${emoji} <b>REGIME CHANGE</b>

<b>${oldRegime}</b> → <b>${newRegime}</b>

${explanation.split('\n').slice(0, 2).join('\n')}`;
}

export function formatPairBiasFlipMessage(
  pair: string,
  oldBias: string,
  newBias: string,
  conviction: number,
  reason: string
): string {
  const arrow = newBias === 'bullish' ? '📈' : newBias === 'bearish' ? '📉' : '⚖️';
  return `${arrow} <b>PAIR FLIP — ${pair}</b>

<b>${oldBias.toUpperCase()}</b> → <b>${newBias.toUpperCase()}</b>
Conviction: ${conviction}%

${reason.split('\n').slice(0, 2).join('\n')}`;
}

export function formatDailyBriefing(
  strongest: Array<{ currency: string; score: number; label: string }>,
  weakest: Array<{ currency: string; score: number; label: string }>,
  regime: string,
  topPairs: Array<{ pair: string; bias: string; conviction: number }>,
  nextEvent: { name: string; currency: string; minutesAway: number } | null
): string {
  const strongStr = strongest.map(c => `${c.currency} (${c.score > 0 ? '+' : ''}${c.score.toFixed(0)})`).join(', ');
  const weakStr = weakest.map(c => `${c.currency} (${c.score.toFixed(0)})`).join(', ');
  const pairsStr = topPairs.slice(0, 5).map(p =>
    `${p.pair}: ${p.bias.toUpperCase()} (${p.conviction}%)`
  ).join('\n');

  const eventStr = nextEvent
    ? `\n⚡ <b>Next Event:</b> ${nextEvent.currency} ${nextEvent.name} in ${nextEvent.minutesAway}m`
    : '';

  return `📊 <b>FOREX FUNDAMENTAL BRIEF</b>

🟢 <b>Strong:</b> ${strongStr}
🔴 <b>Weak:</b> ${weakStr}
🌍 <b>Regime:</b> ${regime}

<b>Top Pair Biases:</b>
${pairsStr}${eventStr}`;
}
