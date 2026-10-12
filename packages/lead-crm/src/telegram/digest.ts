import { MAX_LIST_ROWS, type Digest } from '../store.ts';
import {
  escapeHtml,
  leadDisplayName,
  type Btn,
  type Keyboard,
} from './markup.ts';

const DIGEST_SECTIONS: [keyof Digest, string][] = [
  ['due', '⏰ Пора вернуться'],
  ['stale', '🕐 Без движения 7 дней'],
];

const MAX_DIGEST_NAME = 40;

export function digestMessage(
  digest: Digest,
  botUsername: string,
): { text: string; reply_markup: Keyboard } | null {
  const lines = ['<b>📋 Заявки ждут решения</b>'];
  const rows: Btn[][] = [];
  let hidden = 0;
  for (const [key, title] of DIGEST_SECTIONS) {
    const leads = digest[key];
    const shown = leads.slice(0, MAX_LIST_ROWS - rows.length);
    hidden += leads.length - shown.length;
    if (shown.length === 0) continue;
    lines.push('', `<b>${title}</b>`);
    for (const l of shown) {
      const name = leadDisplayName(l).slice(0, MAX_DIGEST_NAME);
      lines.push(
        `<a href="https://t.me/${botUsername}?start=lead_${l.id}">#${l.id}</a> ${escapeHtml(name)} · ${escapeHtml(l.brand)}`,
      );
      rows.push([
        { text: `✅ #${l.id}`, callback_data: `won:${l.id}` },
        { text: `❌ #${l.id}`, callback_data: `lost:${l.id}` },
        { text: `🔵 #${l.id}`, callback_data: `work:${l.id}` },
      ]);
    }
  }
  if (rows.length === 0) return null;
  if (hidden > 0) lines.push('', `+${hidden} ещё`);
  return {
    text: lines.join('\n'),
    reply_markup: { inline_keyboard: rows },
  };
}
