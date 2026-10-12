import { z } from 'zod';
import { isInWork, type StoredLead } from '../schema.ts';
import { MAX_LIST_ROWS, type Digest } from '../store.ts';
import {
  escapeHtml,
  leadDisplayName,
  statusMark,
  type Btn,
  type Keyboard,
} from './markup.ts';

const DIGEST_SECTIONS: [keyof Digest, string][] = [
  ['due', '⏰ Пора вернуться'],
  ['stale', '🕐 Без движения 7 дней'],
];

const DIGEST_TITLE = '📋 Заявки ждут решения';
const MAX_DIGEST_NAME = 40;

const DIGEST_COPY = {
  done: '✅ Всё разобрано',
} as const;

type DigestView = { text: string; reply_markup: Keyboard };

function digestButtons({ id }: StoredLead): Btn[] {
  return [
    { text: `✅ Сделка #${id}`, callback_data: `won:${id}` },
    { text: `❌ Отказ #${id}`, callback_data: `lost:${id}` },
    { text: `🔵 В работе #${id}`, callback_data: `work:${id}` },
  ];
}

function renderDigest(
  digest: Digest,
  botUsername: string,
  { hidden = 0, withStatus = false } = {},
): DigestView {
  const lines = [`<b>${DIGEST_TITLE}</b>`];
  const rows: Btn[][] = [];
  for (const [key, title] of DIGEST_SECTIONS) {
    const leads = digest[key];
    const shown = leads.slice(0, MAX_LIST_ROWS - rows.length);
    hidden += leads.length - shown.length;
    if (shown.length === 0) continue;
    lines.push('', `<b>${title}</b>`);
    for (const l of shown) {
      const name = leadDisplayName(l).slice(0, MAX_DIGEST_NAME);
      const status = withStatus ? ` · ${statusMark(l.status)}` : '';
      lines.push(
        `<a href="https://t.me/${botUsername}?start=lead_${l.id}">#${l.id}</a> ${escapeHtml(name)} · ${escapeHtml(l.brand)}${status}`,
      );
      rows.push(digestButtons(l));
    }
  }
  if (rows.length === 0) lines.push('', DIGEST_COPY.done);
  if (hidden > 0) lines.push('', `+${hidden} ещё`);
  return { text: lines.join('\n'), reply_markup: { inline_keyboard: rows } };
}

export function digestMessage(
  digest: Digest,
  botUsername: string,
): DigestView | null {
  if (digest.due.length + digest.stale.length === 0) return null;
  return renderDigest(digest, botUsername);
}

const digestButton = (action: string) =>
  z
    .object({ callback_data: z.string().regex(new RegExp(`^${action}:\\d+$`)) })
    .transform(({ callback_data }) => Number(callback_data.split(':')[1]));

const digestMessageSchema = z.object({
  text: z.string(),
  reply_markup: z.object({
    inline_keyboard: z
      .array(
        z.tuple([
          digestButton('won'),
          digestButton('lost'),
          digestButton('work'),
        ]),
      )
      .min(1),
  }),
});

function sectionOf(text: string, id: number): keyof Digest {
  const at = text.indexOf(`#${id} `);
  const stale = text.indexOf(DIGEST_SECTIONS[1]![1]);
  return stale !== -1 && at > stale ? 'stale' : 'due';
}

export function redrawDigest(
  message: unknown,
  leads: StoredLead[],
  actedOn: number,
  botUsername: string,
): DigestView | null {
  const parsed = digestMessageSchema.safeParse(message);
  if (!parsed.success) return null;
  const { text, reply_markup } = parsed.data;
  const digest: Digest = { due: [], stale: [] };
  for (const [id] of reply_markup.inline_keyboard) {
    const lead = leads.find((l) => l.id === id);
    if (id === actedOn || !lead || !isInWork(lead)) continue;
    digest[sectionOf(text, id)].push(lead);
  }
  const hidden = Number(/\n\+(\d+) ещё$/.exec(text)?.[1] ?? 0);
  return renderDigest(digest, botUsername, { hidden, withStatus: true });
}
