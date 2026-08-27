export const prerender = false;

import { timingSafeEqual } from 'node:crypto';
import type { APIContext } from 'astro';
import { updateLeadStatus, answerCallback, isLeadStatusKey } from '@/lib/telegram';

const WEBHOOK_SECRET = import.meta.env.TELEGRAM_WEBHOOK_SECRET;

// Plain `!==` leaks timing info on a security boundary; pad both sides to
// equal length first since timingSafeEqual throws on a length mismatch
// instead of just returning false.
function secretMatches(header: string | null): boolean {
  if (!WEBHOOK_SECRET || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(WEBHOOK_SECRET);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

interface TelegramUpdate {
  callback_query?: {
    id: string;
    data?: string;
    message?: {
      message_id: number;
      text?: string;
      chat: { id: number };
    };
  };
}

export async function POST({ request }: APIContext): Promise<Response> {
  // Telegram echoes this header back on every webhook call once the webhook
  // is registered with a secret_token (see docs/deploy.md) — the only way
  // to confirm a request actually came from Telegram and not a public POST
  // to a guessable URL. Fail closed if it's missing or wrong.
  if (!secretMatches(request.headers.get('x-telegram-bot-api-secret-token'))) {
    return new Response(null, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = await request.json() as TelegramUpdate;
  } catch {
    // Malformed body after a valid secret — ack with 200 so Telegram stops
    // retrying instead of hammering this endpoint forever on a bad payload.
    return new Response(null, { status: 200 });
  }
  const cb = update.callback_query;
  const status = cb?.data?.startsWith('st:') ? cb.data.slice('st:'.length) : undefined;

  if (cb?.message && status && isLeadStatusKey(status)) {
    const message = cb.message;
    try {
      await updateLeadStatus(message.chat.id, message.message_id, message.text ?? '', status);
      await answerCallback(cb.id, 'Статус обновлён');
    } catch (err) {
      console.error('[telegram-webhook] failed to update lead status', { error: err, status });
      await answerCallback(cb.id, 'Ошибка, попробуйте ещё раз').catch(() => {});
    }
  } else if (cb) {
    // Unrecognized/invalid callback (unknown status, missing message, etc.)
    // — still ack it so the button stops spinning.
    await answerCallback(cb.id).catch(() => {});
  }

  // Telegram retries the webhook on anything but 2xx — always ack even for
  // update types we don't act on (messages, other callback data, etc.).
  return new Response(null, { status: 200 });
}
