export const prerender = false;

import type { APIContext } from 'astro';
import { updateLeadStatus } from '../../lib/db';
import { editGroupMessage, answerCallbackQuery } from '../../lib/telegram';
import { ACTION_TO_STATUS } from '../../utils/labels';

export async function POST({ request }: APIContext): Promise<Response> {
  const secret = request.headers.get('x-telegram-bot-api-secret-token');
  if (secret !== import.meta.env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response('Forbidden', { status: 403 });
  }

  const update = await request.json() as Record<string, unknown>;

  if (!update.callback_query) {
    return new Response('ok');
  }

  const cq = update.callback_query as {
    id: string;
    from: { username?: string };
    message: { message_id: number; text: string };
    data: string;
  };

  const [action, idStr] = cq.data.split(':');
  const leadId = Number(idStr);
  const status = ACTION_TO_STATUS[action];
  const handledBy = cq.from.username ?? 'unknown';

  if (!status || !leadId) {
    return new Response('ok');
  }

  try {
    await updateLeadStatus(leadId, status, handledBy);
    await editGroupMessage(cq.message.message_id, cq.message.text, handledBy, status);
    await answerCallbackQuery(cq.id);
  } catch (err) {
    console.error('[telegram webhook] handler error:', err);
  }

  return new Response('ok');
}
