import { MAX_LIST_ROWS, type Digest, type DigestRows } from '../store.ts';
import { escapeHtml, leadDisplayName } from './markup.ts';

const DIGEST_SECTIONS: [keyof Digest, string][] = [
  ['due', '⏰ Пора вернуться'],
  ['stale', '🕐 Без движения 7 дней'],
];

const DIGEST_TITLE = '📋 Заявки ждут решения';
const DIGEST_DONE = '✅ Всё разобрано';
const MAX_DIGEST_NAME = 40;

export type RenderedDigest = DigestRows & { text: string };

export function renderDigest(
  digest: Digest,
  botUsername: string,
  hidden = 0,
): RenderedDigest {
  const lines = [`<b>${DIGEST_TITLE}</b>`];
  const shown = { dueIds: [] as number[], staleIds: [] as number[] };
  let room = MAX_LIST_ROWS;
  for (const [key, title] of DIGEST_SECTIONS) {
    const leads = digest[key];
    const visible = leads.slice(0, room);
    room -= visible.length;
    hidden += leads.length - visible.length;
    if (visible.length === 0) continue;
    lines.push('', `<b>${title}</b>`);
    for (const l of visible) {
      const name = leadDisplayName(l).slice(0, MAX_DIGEST_NAME);
      lines.push(
        `<a href="https://t.me/${botUsername}?start=lead_${l.id}">#${l.id}</a> ${escapeHtml(name)} · ${escapeHtml(l.brand)}`,
      );
      shown[`${key}Ids`].push(l.id);
    }
  }
  if (room === MAX_LIST_ROWS) lines.push('', DIGEST_DONE);
  if (hidden > 0) lines.push('', `+${hidden} ещё`);
  return { text: lines.join('\n'), ...shown, hidden };
}

export function digestMessage(
  digest: Digest,
  botUsername: string,
): RenderedDigest | null {
  if (digest.due.length + digest.stale.length === 0) return null;
  return renderDigest(digest, botUsername);
}
