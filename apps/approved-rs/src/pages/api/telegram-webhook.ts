export const prerender = false;

import type { APIContext } from 'astro';
import { Composer, type Context } from 'grammy';
import { z } from 'zod';
import {
  parse,
  isValid,
  isBefore,
  startOfDay,
  format,
  addDays,
} from 'date-fns';
import { secretMatches } from '@/lib/verifySecret';
import {
  afterStatusChange,
  answerCallback,
  bot,
  ensureLeadCard,
  sendForceReplyPrompt,
  safeEditMessage,
  sendPayoutNotificationToAdmin,
  sendSettlementToOwner,
  sendMessage,
  downloadFile,
  buildToPay,
  buildSearchResults,
  buildMenu,
  buildHelp,
  buildOpenList,
  buildStats,
  formatDateRu,
  buildLeadDetail,
  buildDeleteConfirm,
  buildRemindPicker,
  editLeadDetailMessage,
  OWNER_IDS,
  ADMIN_IDS,
  REPLY_COPY,
  PAYOUT_COPY,
  payoutRecordedMessage,
  OUTCOME_COPY,
  SETTLEMENT_COPY,
  settleKeyboard,
  settlementText,
  DRAFT_COPY,
  draftMessage,
  escapeHtml,
  canAddIncome,
  type Role,
} from '@/lib/telegram';
import { captureClientFor } from '@/lib/captureBot';
import { parsePayout, transcribeVoice } from '@/lib/payoutParser';
import {
  getLead,
  setStatus,
  touchLead,
  deleteLead,
  setPendingPrompt,
  findByPendingPrompt,
  findByCard,
  addNote,
  readLedger,
  correctPayout,
  setPayoutPrompt,
  findPayoutByPrompt,
  findPastLead,
  addDraft,
  getDraft,
  findDraftByPrompt,
  updateDraft,
  discardDraft,
  confirmDraft,
  resolvePendingPrompt,
  searchLeads,
  resumeLead,
  postponeLead,
  canPostpone,
  postponePatch,
  addPayout,
  getBalance,
  addSettlement,
  settleBalance,
  isSettled,
  readLeads,
  appendNote,
  type LeadStatus,
  type Draft,
  type PendingPrompt,
  type Payout,
  type Settlement,
  type StoredLead,
} from '@/lib/store';

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

const messageSchema = z.object({
  message_id: z.number().int(),
  text: z.string().optional(),
  voice: z.object({ file_id: z.string() }).optional(),
  chat: z.object({ id: z.number().int(), type: z.string().optional() }),
  from: z.object({ id: z.number().int() }).optional(),
  reply_to_message: z
    .object({
      message_id: z.number().int(),
      from: z.object({ is_bot: z.boolean() }).optional(),
    })
    .optional(),
});

const readFieldsSchema = z.object({
  message: messageSchema.optional(),
  callback_query: z
    .object({
      id: z.string(),
      data: z.string().optional(),
      from: z.object({ id: z.number().int() }).optional(),
      message: messageSchema.optional(),
    })
    .optional(),
});

const updateSchema = z
  .looseObject({ update_id: z.number().int() })
  .refine((update) => readFieldsSchema.safeParse(update).success);

type TelegramMessage = z.infer<typeof messageSchema>;

const ACK = new Response(null, { status: 200 });

const SEEN_UPDATE_IDS_MAX = 500;
const seenUpdateIds = new Set<number>();
const seenUpdateIdsOrder: number[] = [];

function alreadyProcessed(updateId: number): boolean {
  if (seenUpdateIds.has(updateId)) return true;
  seenUpdateIds.add(updateId);
  seenUpdateIdsOrder.push(updateId);
  if (seenUpdateIdsOrder.length > SEEN_UPDATE_IDS_MAX) {
    const oldest = seenUpdateIdsOrder.shift();
    if (oldest !== undefined) seenUpdateIds.delete(oldest);
  }
  return false;
}

function roleOf(id: number | undefined): Role | undefined {
  if (id == null) return undefined;
  if (OWNER_IDS.includes(id)) return 'owner';
  if (ADMIN_IDS.includes(id)) return 'admin';
  return undefined;
}

const MAX_AMOUNT = 1_000_000;

const amountSchema = z
  .string()
  .transform((text) =>
    text
      .replace(/[^\d.,-]/g, '')
      .replace(/\.$/, '')
      .replace(',', '.'),
  )
  .refine((digits) => /^\d+(\.\d+)?$/.test(digits))
  .transform((digits) => Number(digits))
  .pipe(z.number().max(MAX_AMOUNT));

function parseAmount(text: string, allowZero = false): number | null {
  const parsed = amountSchema.safeParse(text);
  if (!parsed.success) return null;
  return parsed.data > 0 || (allowZero && parsed.data === 0)
    ? parsed.data
    : null;
}

const plainAmountSchema = z
  .string()
  .transform((text) =>
    text
      .replace(/\s+/g, '')
      .replace(/\.$/, '')
      .replace(/(€|eur|евро)$/i, '')
      .replace(',', '.'),
  )
  .pipe(z.string().regex(/^\d+(\.\d+)?$/))
  .transform(Number)
  .pipe(z.number().max(MAX_AMOUNT));

function parsePlainAmount(text: string): number | null {
  const parsed = plainAmountSchema.safeParse(text);
  return parsed.success ? parsed.data : null;
}

function parseReminderDate(text: string): string | null {
  const parsed = parse(text.trim(), 'dd.MM.yyyy', new Date());
  if (!isValid(parsed) || isBefore(parsed, startOfDay(new Date()))) return null;
  return format(parsed, 'yyyy-MM-dd');
}

function quickRemindDate(days: number): string {
  return format(addDays(new Date(), days), 'yyyy-MM-dd');
}

type Ctx = { chatId: number; messageId: number; role: Role; cbId: string };
type CrmContext = Context & { crm: Ctx };
type Handler = (ctx: Ctx, ...groups: string[]) => Promise<void>;
type LeadHandler = (ctx: Ctx, id: number, ...rest: string[]) => Promise<void>;
type CallbackRow = [RegExp, Role | 'any', Handler];
type PromptKind = PendingPrompt['kind'];

function onLead(handler: LeadHandler): Handler {
  return (ctx, id, ...rest) => handler(ctx, Number(id), ...rest);
}

async function ack(ctx: Ctx): Promise<void> {
  await answerCallback(ctx.cbId).catch(() => {});
}

async function withErrorAck(
  cbId: string,
  logCtx: Record<string, unknown>,
  action: () => Promise<void>,
): Promise<void> {
  try {
    await action();
  } catch (err) {
    console.error('[telegram-webhook] callback handler failed', {
      error: err,
      ...logCtx,
    });
    await answerCallback(cbId, 'Ошибка, попробуйте ещё раз').catch(() => {});
  }
}

async function afterStatusChangeOn(
  { chatId, messageId, role }: Ctx,
  updated: StoredLead,
): Promise<void> {
  await afterStatusChange(updated, { surface: { chatId, messageId, role } });
}

async function startPrompt(
  ctx: Ctx,
  id: number,
  {
    prompt,
    kind,
    ackText,
  }: { prompt: string; kind: PromptKind; ackText: string },
): Promise<void> {
  const promptId = await sendForceReplyPrompt(ctx.chatId, prompt);
  await setPendingPrompt(id, { chatId: ctx.chatId, messageId: promptId, kind });
  await answerCallback(ctx.cbId, ackText);
}

async function startLeadPrompt(
  ctx: Ctx,
  id: number,
  prompt: Parameters<typeof startPrompt>[2],
): Promise<void> {
  if (!(await getLead(id))) return ack(ctx);
  await startPrompt(ctx, id, prompt);
}

async function changeStatus(
  ctx: Ctx,
  id: number,
  key: LeadStatus,
  fromDetail = true,
): Promise<void> {
  const lead = await getLead(id);
  if (!lead) return ack(ctx);
  const updated = lead.status === key ? undefined : await setStatus(id, key);
  if (updated)
    await (fromDetail
      ? afterStatusChangeOn(ctx, updated)
      : afterStatusChange(updated));
  if (key !== 'won') return answerCallback(ctx.cbId, 'Статус обновлён');
  await startPrompt(ctx, id, {
    prompt: OUTCOME_COPY.wonPrompt,
    kind: 'deal_amount',
    ackText: OUTCOME_COPY.wonAck,
  });
}

async function markInWork(ctx: Ctx, id: number): Promise<void> {
  await touchLead(id);
  await answerCallback(ctx.cbId, OUTCOME_COPY.workAck);
}

async function openRemindPicker(ctx: Ctx, id: number): Promise<void> {
  if (!(await getLead(id))) return ack(ctx);
  const { text, reply_markup } = buildRemindPicker(id);
  await safeEditMessage(ctx.chatId, ctx.messageId, text, reply_markup);
  await answerCallback(ctx.cbId);
}

async function remindIn(ctx: Ctx, id: number, days: string): Promise<void> {
  const remindAt = quickRemindDate(Number(days));
  const updated = await postponeLead(
    id,
    remindAt,
    `Отложено до ${formatDateRu(remindAt)}`,
  );
  if (!updated) return ack(ctx);
  await afterStatusChangeOn(ctx, updated);
  await answerCallback(ctx.cbId, 'Отложено');
}

async function resume(ctx: Ctx, id: number): Promise<void> {
  const updated = await resumeLead(id);
  if (!updated) return ack(ctx);
  await afterStatusChangeOn(ctx, updated);
  await answerCallback(ctx.cbId, 'Возобновлено');
}

async function backToLead(ctx: Ctx, id: number): Promise<void> {
  const lead = await getLead(id);
  if (lead) {
    await editLeadDetailMessage(ctx.chatId, ctx.messageId, lead, ctx.role);
  } else {
    await safeEditMessage(ctx.chatId, ctx.messageId, 'Заявка не найдена.', {
      inline_keyboard: [],
    });
  }
  await answerCallback(ctx.cbId);
}

async function askDelete(ctx: Ctx, id: number): Promise<void> {
  const lead = await getLead(id);
  if (!lead) return ack(ctx);
  const { text, reply_markup } = buildDeleteConfirm(lead);
  await safeEditMessage(ctx.chatId, ctx.messageId, text, reply_markup);
  await answerCallback(ctx.cbId);
}

async function confirmDelete(ctx: Ctx, id: number): Promise<void> {
  await deleteLead(id);
  await safeEditMessage(ctx.chatId, ctx.messageId, '🗑 Заявка удалена.', {
    inline_keyboard: [],
  });
  await answerCallback(ctx.cbId, 'Удалено');
}

async function askIncome(ctx: Ctx, id: number): Promise<void> {
  const lead = await getLead(id);
  if (!lead || !canAddIncome(lead, 'owner')) return ack(ctx);
  await startPrompt(ctx, id, {
    prompt:
      '💶 Сколько получил (в евро)? Предоплата или частичный расчёт — твоя прибыль, не стоимость машины.\n\nНапример: 150',
    kind: 'add_income',
    ackText: 'Жду сумму',
  });
}

async function askAmount(ctx: Ctx): Promise<number> {
  const promptId = await sendForceReplyPrompt(
    ctx.chatId,
    PAYOUT_COPY.fixPrompt,
  );
  await answerCallback(ctx.cbId, PAYOUT_COPY.fixAck);
  return promptId;
}

async function askPayoutFix(ctx: Ctx, payoutId: number): Promise<void> {
  const { payouts, settlements } = await readLedger();
  const payout = payouts.find((p) => p.id === payoutId);
  if (!payout) return ack(ctx);
  if (ctx.role === 'owner' && isSettled(payout, settlements)) {
    await answerCallback(ctx.cbId, PAYOUT_COPY.settled);
    return;
  }
  await setPayoutPrompt(payoutId, {
    chatId: ctx.chatId,
    messageId: await askAmount(ctx),
  });
}

async function showToPay(ctx: Ctx): Promise<void> {
  const balance = await getBalance();
  await sendMessage(ctx.chatId, buildToPay(balance), {
    reply_markup: ctx.role === 'admin' ? settleKeyboard(balance) : undefined,
  });
  await ack(ctx);
}

const leadOf = async (leadId: number | null) =>
  leadId == null ? undefined : getLead(leadId);

async function showDraft(
  chatId: number,
  messageId: number,
  draft: Draft,
): Promise<void> {
  const { text, reply_markup } = draftMessage(
    draft,
    await leadOf(draft.leadId),
  );
  await safeEditMessage(chatId, messageId, text, reply_markup);
}

async function settleMatch(
  ctx: Ctx,
  id: number,
  keepLead: boolean,
): Promise<void> {
  const draft = await updateDraft(
    id,
    keepLead ? { matchPending: false } : { matchPending: false, leadId: null },
  );
  if (draft) await showDraft(ctx.chatId, ctx.messageId, draft);
  await ack(ctx);
}

async function askDraftFix(ctx: Ctx, id: number): Promise<void> {
  if (!(await getDraft(id))) return ack(ctx);
  await updateDraft(id, {
    pendingPrompt: {
      chatId: ctx.chatId,
      messageId: await askAmount(ctx),
      draftMessageId: ctx.messageId,
    },
  });
}

async function discardDraftTap(ctx: Ctx, id: number): Promise<void> {
  if (await discardDraft(id)) {
    await safeEditMessage(ctx.chatId, ctx.messageId, DRAFT_COPY.discarded, {
      inline_keyboard: [],
    });
  }
  await ack(ctx);
}

async function confirmDraftTap(ctx: Ctx, id: number): Promise<void> {
  const before = await leadOf((await getDraft(id))?.leadId ?? null);
  const payout = await confirmDraft(id);
  if (!payout) return ack(ctx);
  const lead = await leadOf(payout.leadId);
  if (lead && lead.status !== before?.status)
    await afterStatusChange(lead, { notice: false });
  await sendPayoutNotificationToAdmin(lead, payout);
  const { text, reply_markup } = payoutRecordedMessage(payout);
  await safeEditMessage(ctx.chatId, ctx.messageId, text, reply_markup);
  await ack(ctx);
}

async function recordedSettlement(settlement: Settlement): Promise<string> {
  const balance = await getBalance();
  await sendSettlementToOwner(settlement, balance);
  return settlementText(settlement, balance);
}

async function settle(ctx: Ctx, shownBalance: string): Promise<void> {
  const settlement = await settleBalance(Number(shownBalance));
  await bot.api.editMessageReplyMarkup(ctx.chatId, ctx.messageId, {
    reply_markup: { inline_keyboard: [] },
  });
  if (!settlement) {
    const balance = await getBalance();
    await sendMessage(ctx.chatId, buildToPay(balance), {
      reply_markup: settleKeyboard(balance),
      ...threadedTo(ctx.messageId),
    });
    await answerCallback(ctx.cbId, SETTLEMENT_COPY.stale);
    return;
  }
  await sendMessage(
    ctx.chatId,
    await recordedSettlement(settlement),
    threadedTo(ctx.messageId),
  );
  await ack(ctx);
}

async function askSettlement(ctx: Ctx): Promise<void> {
  await sendForceReplyPrompt(ctx.chatId, SETTLEMENT_COPY.prompt);
  await answerCallback(ctx.cbId, SETTLEMENT_COPY.ack);
}

async function listOpen(ctx: Ctx): Promise<void> {
  const { text, reply_markup } = buildOpenList(await readLeads());
  await sendMessage(ctx.chatId, text, { reply_markup });
  await ack(ctx);
}

async function openLead(ctx: Ctx, id: number): Promise<void> {
  const lead = await getLead(id);
  if (lead) {
    const { text, reply_markup } = buildLeadDetail(lead, ctx.role);
    await sendMessage(ctx.chatId, text, { reply_markup });
  }
  await ack(ctx);
}

function statusRow(key: LeadStatus): CallbackRow {
  return [
    new RegExp(`^st:(\\d+):${key}$`),
    'owner',
    onLead((ctx, id) => changeStatus(ctx, id, key)),
  ];
}

export const CALLBACKS: CallbackRow[] = [
  statusRow('won'),
  statusRow('lost'),
  [
    /^won:(\d+)$/,
    'owner',
    onLead((ctx, id) => changeStatus(ctx, id, 'won', false)),
  ],
  [
    /^lost:(\d+)$/,
    'owner',
    onLead((ctx, id) => changeStatus(ctx, id, 'lost', false)),
  ],
  [/^work:(\d+)$/, 'owner', onLead(markInWork)],
  [/^postpone:(\d+)$/, 'owner', onLead(openRemindPicker)],
  [/^remindpick:(\d+):(\d+)$/, 'owner', onLead(remindIn)],
  [
    /^remindtype:(\d+)$/,
    'owner',
    onLead((ctx, id) =>
      startLeadPrompt(ctx, id, {
        prompt:
          '⏰ На какую дату напомнить? (ДД.ММ.ГГГГ)\n\nНапример: 20.10.2026',
        kind: 'postpone',
        ackText: 'Жду дату',
      }),
    ),
  ],
  [/^remindcancel:(\d+)$/, 'owner', onLead(backToLead)],
  [/^resume:(\d+)$/, 'any', onLead(resume)],
  [/^del:(\d+)$/, 'admin', onLead(askDelete)],
  [/^delconfirm:(\d+)$/, 'admin', onLead(confirmDelete)],
  [/^delcancel:(\d+)$/, 'admin', onLead(backToLead)],
  [/^income:(\d+)$/, 'owner', onLead(askIncome)],
  [/^payfix:(\d+)$/, 'any', onLead(askPayoutFix)],
  [/^settle:other$/, 'admin', askSettlement],
  [/^settle:(\d+(?:\.\d+)?)$/, 'admin', settle],
  [/^draft:(\d+):ok$/, 'owner', onLead(confirmDraftTap)],
  [/^draft:(\d+):edit$/, 'owner', onLead(askDraftFix)],
  [/^draft:(\d+):no$/, 'owner', onLead(discardDraftTap)],
  [
    /^draft:(\d+):him$/,
    'owner',
    onLead((ctx, id) => settleMatch(ctx, id, true)),
  ],
  [
    /^draft:(\d+):other$/,
    'owner',
    onLead((ctx, id) => settleMatch(ctx, id, false)),
  ],
  [
    /^reply:(\d+)$/,
    'any',
    onLead((ctx, id) =>
      startLeadPrompt(ctx, id, {
        prompt: REPLY_COPY.prompt,
        kind: 'reply_visitor',
        ackText: REPLY_COPY.ack,
      }),
    ),
  ],
  [/^menu:open$/, 'any', listOpen],
  [/^open:(\d+)$/, 'any', onLead(openLead)],
  [
    /^menu:stats$/,
    'admin',
    async (ctx) => {
      await sendMessage(ctx.chatId, buildStats(await readLeads()));
      await ack(ctx);
    },
  ],
  [/^menu:debt$/, 'any', showToPay],
];

function callbackCtx(cb: {
  id: string;
  from?: { id: number };
  message?: { message_id: number; chat: { id: number } };
}): Ctx | undefined {
  const role = roleOf(cb.from?.id);
  if (!cb.message || !role) return undefined;
  return {
    chatId: cb.message.chat.id,
    messageId: cb.message.message_id,
    role,
    cbId: cb.id,
  };
}

const callbacks = new Composer<CrmContext>();

for (const [pattern, needed, handler] of CALLBACKS) {
  callbacks.callbackQuery(pattern, ({ crm, match, callbackQuery }) =>
    needed !== 'any' && needed !== crm.role
      ? ack(crm)
      : withErrorAck(crm.cbId, { data: callbackQuery.data }, () =>
          handler(crm, ...match.slice(1)),
        ),
  );
}

callbacks.use(async ({ crm, callbackQuery }) => {
  console.warn('[telegram-webhook] unknown callback data', {
    data: callbackQuery?.data ?? '',
  });
  await ack(crm);
});

async function replyWithCard(
  chatId: number,
  lead: StoredLead,
  headline: string,
): Promise<void> {
  const role = roleOf(chatId);
  if (!role) {
    await sendMessage(chatId, headline);
    return;
  }
  const { text, reply_markup } = buildLeadDetail(lead, role);
  await sendMessage(chatId, `${headline}\n\n${text}`, { reply_markup });
}

type PromptReply = {
  role: Role;
  chatId: number;
  messageId: number;
  replyToMessageId: number;
  text: string;
  pending: StoredLead;
};
type PromptHandler = (reply: PromptReply) => Promise<void>;

async function replyDealAmount({
  role,
  chatId,
  messageId,
  replyToMessageId,
  text,
}: PromptReply): Promise<void> {
  const amount = parseAmount(text, true);
  if (amount == null) {
    await sendMessage(chatId, OUTCOME_COPY.badAmount);
    return;
  }
  const resolved = await resolvePendingPrompt(
    chatId,
    replyToMessageId,
    () => ({}),
  );
  if (!resolved) return;
  const payout = await addPayout({ amount, by: role, leadId: resolved.id });
  if (!payout) return;
  await sendPayoutNotificationToAdmin(resolved, payout);
  await sendPayoutRecorded(chatId, messageId, payout);
}

async function replyAddIncome({
  role,
  chatId,
  replyToMessageId,
  text,
}: PromptReply): Promise<void> {
  const amount = parseAmount(text);
  if (amount == null) {
    await sendMessage(chatId, '⚠️ Нужна сумма в евро. Попробуйте ещё раз.');
    return;
  }
  const resolved = await resolvePendingPrompt(
    chatId,
    replyToMessageId,
    () => ({}),
  );
  if (!resolved || !canAddIncome(resolved, 'owner')) return;
  const payout = await addPayout({ amount, by: role, leadId: resolved.id });
  if (!payout) return;
  await sendPayoutNotificationToAdmin(resolved, payout);
  await replyWithCard(chatId, resolved, '✅ Доход добавлен');
}

async function replyPostpone({
  chatId,
  replyToMessageId,
  text,
}: PromptReply): Promise<void> {
  const remindAt = parseReminderDate(text);
  if (remindAt == null) {
    await sendMessage(
      chatId,
      '⚠️ Нужна дата в формате ДД.ММ.ГГГГ, не в прошлом. Попробуйте ещё раз.',
    );
    return;
  }
  const updated = await resolvePendingPrompt(
    chatId,
    replyToMessageId,
    (lead) =>
      canPostpone(lead)
        ? postponePatch(lead, remindAt, `Отложено до ${formatDateRu(remindAt)}`)
        : {},
  );
  if (updated?.status === 'postponed') await afterStatusChange(updated);
}

async function replyVisitor({
  chatId,
  replyToMessageId,
  text,
  pending,
}: PromptReply): Promise<void> {
  const reply = text.trim();
  if (!reply) {
    await sendMessage(chatId, REPLY_COPY.empty);
    return;
  }
  const undelivered = () => sendMessage(chatId, REPLY_COPY.undelivered);
  const client = captureClientFor(pending.brand);
  if (pending.telegramId == null || !client) {
    console.warn('[telegram-webhook] reply to visitor has no route', {
      id: pending.id,
      brand: pending.brand,
      reason: client ? 'no telegramId' : 'no capture bot for brand',
    });
    await undelivered();
    return;
  }
  try {
    await client.sendMessage(pending.telegramId, escapeHtml(reply));
  } catch (err) {
    console.error('[telegram-webhook] reply to visitor failed', {
      id: pending.id,
      error: err,
    });
    await undelivered();
    return;
  }
  const updated = await resolvePendingPrompt(
    chatId,
    replyToMessageId,
    (lead) => ({
      comment: appendNote(lead.comment, `${REPLY_COPY.notePrefix}${reply}`),
    }),
  );
  if (updated) {
    await ensureLeadCard(updated);
    await replyWithCard(chatId, updated, REPLY_COPY.sent);
  }
}

function threadedTo(messageId: number) {
  return {
    reply_parameters: {
      message_id: messageId,
      allow_sending_without_reply: true,
    },
  };
}

async function sendPayoutRecorded(
  chatId: number,
  replyTo: number,
  payout: Payout,
): Promise<void> {
  const { text, reply_markup } = payoutRecordedMessage(payout);
  await sendMessage(chatId, text, { reply_markup, ...threadedTo(replyTo) });
}

const PROMPT_REPLIES: Record<PromptKind, PromptHandler> = {
  deal_amount: replyDealAmount,
  add_income: replyAddIncome,
  postpone: replyPostpone,
  reply_visitor: replyVisitor,
};

type Reply = Omit<PromptReply, 'pending'> & {
  repliedText: string;
  spoken: boolean;
};

async function replyToPrompt(reply: Reply): Promise<boolean> {
  const pending = await findByPendingPrompt(
    reply.chatId,
    reply.replyToMessageId,
  );
  if (!pending?.pendingPrompt) return false;
  await PROMPT_REPLIES[pending.pendingPrompt.kind]({ ...reply, pending });
  return true;
}

async function replyToPayoutPrompt(reply: Reply): Promise<boolean> {
  const payout = await findPayoutByPrompt(reply.chatId, reply.replyToMessageId);
  if (!payout) return false;
  const amount = parseAmount(reply.text, true);
  if (amount == null) {
    await sendMessage(reply.chatId, PAYOUT_COPY.invalidAmount);
    return true;
  }
  const outcome = await correctPayout(payout.id, amount, reply.role);
  if (!outcome.ok) {
    await setPayoutPrompt(payout.id, null);
    await sendMessage(reply.chatId, PAYOUT_COPY.settled);
    return true;
  }
  await sendPayoutNotificationToAdmin(
    await leadOf(payout.leadId),
    outcome.payout,
  );
  await sendPayoutRecorded(reply.chatId, reply.messageId, outcome.payout);
  return true;
}

async function replyToDraftPrompt(reply: Reply): Promise<boolean> {
  const draft = await findDraftByPrompt(reply.chatId, reply.replyToMessageId);
  if (!draft?.pendingPrompt) return false;
  const amount = parseAmount(reply.text);
  if (amount == null) {
    await sendMessage(reply.chatId, PAYOUT_COPY.invalidAmount);
    return true;
  }
  const updated = await updateDraft(draft.id, { amount, pendingPrompt: null });
  if (updated)
    await showDraft(reply.chatId, draft.pendingPrompt.draftMessageId, updated);
  return true;
}

async function replyToCard(reply: Reply): Promise<boolean> {
  const lead = await findByCard(reply.chatId, reply.replyToMessageId);
  if (!lead) return false;
  const text = reply.text.trim();
  if (!text) return true;
  if (reply.spoken && (await draftPayout({ ...reply, text, lead })))
    return true;
  const amount = parsePlainAmount(text);
  if (amount == null) {
    await addNote(lead.id, text);
    await sendMessage(
      reply.chatId,
      PAYOUT_COPY.noteAdded,
      threadedTo(reply.messageId),
    );
    return true;
  }
  const payout = await addPayout({ amount, by: reply.role, leadId: lead.id });
  const updated = await getLead(lead.id);
  if (!payout || !updated) return true;
  if (updated.status !== lead.status)
    await afterStatusChange(updated, { notice: false });
  await sendPayoutNotificationToAdmin(updated, payout);
  await sendPayoutRecorded(reply.chatId, reply.messageId, payout);
  return true;
}

async function replyToSettlementPrompt(reply: Reply): Promise<boolean> {
  if (reply.repliedText !== SETTLEMENT_COPY.prompt) return false;
  if (reply.role !== 'admin') return true;
  const amount = parseAmount(reply.text);
  if (amount == null) {
    await sendMessage(reply.chatId, PAYOUT_COPY.invalidAmount);
    return true;
  }
  const settlement = await addSettlement(amount);
  await sendMessage(
    reply.chatId,
    await recordedSettlement(settlement),
    threadedTo(reply.messageId),
  );
  return true;
}

const REPLY_ROUTES = [
  replyToPrompt,
  replyToPayoutPrompt,
  replyToSettlementPrompt,
  replyToDraftPrompt,
  replyToCard,
];

type OwnerMessage = {
  chatId: number;
  messageId: number;
  text: string;
  role: Role;
  lead?: StoredLead;
};

async function draftPayout({
  chatId,
  messageId,
  text,
  role,
  lead: cardLead,
}: OwnerMessage): Promise<boolean> {
  let hints: Awaited<ReturnType<typeof parsePayout>>;
  try {
    hints = await parsePayout(text);
  } catch (error) {
    console.error('[telegram-webhook] payout parse failed', { error });
    await sendMessage(chatId, DRAFT_COPY.unreadable, threadedTo(messageId));
    return true;
  }
  if (!hints) return false;
  const lead =
    cardLead ??
    (await findPastLead({ name: hints.clientName, phone: hints.clientPhone }));
  const draft = await addDraft({
    amount: hints.amount,
    note: hints.note,
    brand: hints.brand,
    leadId: lead?.id ?? null,
    matchPending: lead != null && !cardLead,
    by: role,
  });
  const { text: body, reply_markup } = draftMessage(draft, lead);
  await sendMessage(chatId, body, { reply_markup, ...threadedTo(messageId) });
  return true;
}

async function heard(
  chatId: number,
  message: { message_id: number; text?: string; voice?: { file_id: string } },
): Promise<string | undefined> {
  if (!message.voice) return message.text ?? '';
  try {
    const text = await transcribeVoice(
      await downloadFile(message.voice.file_id),
    );
    if (text) return text;
  } catch (error) {
    console.error('[telegram-webhook] voice transcription failed', { error });
  }
  await sendMessage(chatId, DRAFT_COPY.unheard, threadedTo(message.message_id));
  return undefined;
}

async function routeReply(reply: Reply): Promise<void> {
  for (const route of REPLY_ROUTES) if (await route(reply)) return;
}

async function sendMenuMessage(chatId: number, role: Role): Promise<void> {
  const menu = buildMenu(role);
  await sendMessage(chatId, menu.text, { reply_markup: menu.reply_markup });
}

async function handlePrivateMessage(msg: TelegramMessage): Promise<void> {
  const chatId = msg.chat.id;
  const role = roleOf(msg.from?.id);
  const text = (msg.text ?? '').trim();

  const startMatch = /^\/start(?:\s+(\S+))?$/.exec(text);
  if (startMatch || text === '/menu') {
    if (!role) {
      await sendMessage(chatId, '⛔ Доступ запрещён.');
      return;
    }
    const payload = startMatch?.[1];
    const leadMatch = payload ? /^lead_(\d+)$/.exec(payload) : null;
    if (leadMatch) {
      const lead = await getLead(Number(leadMatch[1]));
      if (lead) {
        const { text: detailText, reply_markup } = buildLeadDetail(lead, role);
        await sendMessage(chatId, detailText, { reply_markup });
        return;
      }
    }
    await sendMenuMessage(chatId, role);
    return;
  }

  if (!role) {
    await sendMessage(chatId, '⛔ Доступ запрещён.');
    return;
  }

  if (text === '/help') {
    await sendMessage(chatId, buildHelp(role));
    return;
  }

  const results = await searchLeads(text);
  const { text: resultsText, reply_markup } = buildSearchResults(results);
  await sendMessage(chatId, resultsText, { reply_markup });
}

bot.use(async (ctx, next) => {
  if (alreadyProcessed(ctx.update.update_id)) return;
  await next();
});

bot.on('callback_query', async (ctx, next) => {
  const crm = callbackCtx(ctx.callbackQuery);
  if (!crm) {
    await ctx.answerCallbackQuery().catch(() => {});
    return;
  }
  await callbacks.middleware()(Object.assign(ctx, { crm }), next);
});

bot.on('message', async (ctx, next) => {
  const repliedTo = ctx.message.reply_to_message;
  if (!repliedTo) return next();
  const role = roleOf(ctx.from?.id);
  if (!role) return;
  const spoken = ctx.message.voice != null;
  if (spoken && !repliedTo.from?.is_bot) return;
  const text = await heard(ctx.chat.id, ctx.message);
  if (text === undefined) return;
  await routeReply({
    role,
    chatId: ctx.chat.id,
    messageId: ctx.message.message_id,
    replyToMessageId: repliedTo.message_id,
    repliedText: repliedTo.text ?? '',
    text,
    spoken,
  });
});

bot
  .chatType('private')
  .on('message', (ctx) => handlePrivateMessage(ctx.message));

bot
  .chatType(['group', 'supergroup'])
  .on(['message:text', 'message:voice'], async (ctx) => {
    if (roleOf(ctx.from.id) !== 'owner') return;
    const text = await heard(ctx.chat.id, ctx.message);
    if (text === undefined) return;
    await draftPayout({
      chatId: ctx.chat.id,
      messageId: ctx.message.message_id,
      text,
      role: 'owner',
    });
  });

export async function POST({ request }: APIContext): Promise<Response> {
  if (
    !secretMatches(
      request.headers.get('x-telegram-bot-api-secret-token'),
      WEBHOOK_SECRET,
    )
  ) {
    return new Response(null, { status: 401 });
  }

  const parsed = updateSchema.safeParse(
    await request.json().catch(() => undefined),
  );
  if (!parsed.success) {
    console.warn('[telegram-webhook] ignoring unparseable update', {
      issues: parsed.error.issues,
    });
    return ACK;
  }

  try {
    await bot.handleUpdate(parsed.data);
  } catch (err) {
    console.error('[telegram-webhook] unhandled error processing update', {
      error: err,
    });
  }

  return ACK;
}
