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
  sendCommissionClaimToAdmin,
  sendCommissionResultToOwner,
  sendFieldChangeToAdmin,
  sendMessage,
  buildToPay,
  formatDealsList,
  buildSearchResults,
  buildMenu,
  buildHelp,
  buildLeadList,
  buildStats,
  formatDateRu,
  buildLeadDetail,
  buildDeleteConfirm,
  buildRemindPicker,
  editLeadDetailMessage,
  OWNER_IDS,
  ADMIN_IDS,
  EDIT_COPY,
  REPLY_COPY,
  PAYOUT_COPY,
  payoutRecordedMessage,
  OUTCOME_COPY,
  escapeHtml,
  canAddIncome,
  LEAD_STATUS_ACTIONS,
  type Role,
  type EditField,
} from '@/lib/telegram';
import { captureClientFor } from '@/lib/captureBot';
import {
  getLead,
  setStatus,
  touchLead,
  archiveLead,
  unarchiveLead,
  deleteLead,
  confirmCommissionPayment,
  claimCommission,
  rejectCommissionPayment,
  setPendingPrompt,
  findByPendingPrompt,
  findByCard,
  addNote,
  listPayouts,
  correctPayout,
  resolvePendingPrompt,
  searchLeads,
  resumeLead,
  postponeLead,
  canPostpone,
  postponePatch,
  addPayout,
  getBalance,
  readLeads,
  getCommission,
  appendNote,
  type LeadStatus,
  type PendingPrompt,
  type Payout,
  type StoredLead,
} from '@/lib/store';

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

const messageSchema = z.object({
  message_id: z.number().int(),
  text: z.string().optional(),
  chat: z.object({ id: z.number().int(), type: z.string().optional() }),
  from: z.object({ id: z.number().int() }).optional(),
  reply_to_message: z.object({ message_id: z.number().int() }).optional(),
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
  .transform((text) => text.replace(/[^\d.,-]/g, '').replace(',', '.'))
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
type OperatorEditField = Exclude<EditField, 'service'>;

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

async function refreshBothSurfaces(
  ctx: Ctx,
  updated: StoredLead | undefined,
): Promise<void> {
  if (!updated) return;
  await ensureLeadCard(updated);
  await editLeadDetailMessage(ctx.chatId, ctx.messageId, updated, ctx.role);
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
    payoutId,
  }: { prompt: string; kind: PromptKind; ackText: string; payoutId?: number },
): Promise<void> {
  const promptId = await sendForceReplyPrompt(ctx.chatId, prompt);
  await setPendingPrompt(id, {
    chatId: ctx.chatId,
    messageId: promptId,
    kind,
    payoutId,
  });
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

async function archive(ctx: Ctx, id: number): Promise<void> {
  await refreshBothSurfaces(ctx, await archiveLead(id));
  await answerCallback(ctx.cbId, 'Архивировано');
}

async function unarchive(ctx: Ctx, id: number): Promise<void> {
  await refreshBothSurfaces(ctx, await unarchiveLead(id));
  await answerCallback(ctx.cbId, 'Восстановлено');
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

async function askPayoutFix(ctx: Ctx, payoutId: number): Promise<void> {
  const payout = (await listPayouts()).find((p) => p.id === payoutId);
  // TODO: a Lead-less Payout has no Lead to hold the correction prompt (#237)
  if (payout?.leadId == null) return ack(ctx);
  await startLeadPrompt(ctx, payout.leadId, {
    prompt: PAYOUT_COPY.fixPrompt,
    kind: 'correct_payout',
    ackText: PAYOUT_COPY.fixAck,
    payoutId,
  });
}

async function claimPay(ctx: Ctx, id: number, target?: string): Promise<void> {
  const lead = await getLead(id);
  if (!lead || lead.dealAmount == null) return ack(ctx);
  const { isPaidOff } = getCommission(lead);
  if (isPaidOff || lead.pendingCommissionClaim) return ack(ctx);
  const updated = await claimCommission(
    id,
    target == null ? null : [Number(target)],
  );
  if (!updated) return ack(ctx);
  await refreshBothSurfaces(ctx, updated);
  await sendCommissionClaimToAdmin(updated);
  await answerCallback(ctx.cbId, 'Отмечено — ждём подтверждения');
}

async function settlePay(ctx: Ctx, id: number, paid: boolean): Promise<void> {
  const updated = await (paid
    ? confirmCommissionPayment(id)
    : rejectCommissionPayment(id));
  await refreshBothSurfaces(ctx, updated);
  if (updated) await sendCommissionResultToOwner(updated, paid);
  await answerCallback(ctx.cbId);
}

async function listLeads(ctx: Ctx, statuses: string): Promise<void> {
  const { text, reply_markup } = buildLeadList(
    await readLeads(),
    statuses.split('+') as LeadStatus[],
  );
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

function statusRow(key: LeadStatus, role: Role | 'any'): CallbackRow {
  return [
    new RegExp(`^st:(\\d+):${key}$`),
    role,
    onLead((ctx, id) => changeStatus(ctx, id, key)),
  ];
}

function editRow(field: OperatorEditField): CallbackRow {
  return [
    new RegExp(`^edit:(\\d+):${field}$`),
    'any',
    onLead((ctx, id) =>
      startLeadPrompt(ctx, id, {
        prompt: EDIT_COPY.prompt(field),
        kind: `edit_${field}`,
        ackText: EDIT_COPY.ack,
      }),
    ),
  ];
}

export const CALLBACKS: CallbackRow[] = [
  ...LEAD_STATUS_ACTIONS.map(({ key }) =>
    statusRow(key, key === 'won' || key === 'lost' ? 'owner' : 'any'),
  ),
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
  [/^arch:(\d+)$/, 'any', onLead(archive)],
  [/^unarch:(\d+)$/, 'any', onLead(unarchive)],
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
  [/^claimpay:(\d+)(?::(\d+))?$/, 'owner', onLead(claimPay)],
  [/^income:(\d+)$/, 'owner', onLead(askIncome)],
  [/^payfix:(\d+)$/, 'any', onLead(askPayoutFix)],
  [
    /^confirmpay:(\d+)$/,
    'admin',
    onLead((ctx, id) => settlePay(ctx, id, true)),
  ],
  [
    /^rejectpay:(\d+)$/,
    'admin',
    onLead((ctx, id) => settlePay(ctx, id, false)),
  ],
  editRow('name'),
  editRow('contact'),
  editRow('comment'),
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
  [
    /^list:(new|negotiations|in_progress|won|lost|postponed|in_progress\+postponed)$/,
    'any',
    listLeads,
  ],
  [/^open:(\d+)$/, 'any', onLead(openLead)],
  [
    /^menu:stats$/,
    'any',
    async (ctx) => {
      await sendMessage(ctx.chatId, buildStats(await readLeads(), ctx.role));
      await ack(ctx);
    },
  ],
  [
    /^menu:debt$/,
    'any',
    async (ctx) => {
      await sendMessage(ctx.chatId, buildToPay(await getBalance()));
      await ack(ctx);
    },
  ],
  [
    /^menu:deals$/,
    'admin',
    async (ctx) => {
      await sendMessage(ctx.chatId, formatDealsList(await readLeads()));
      await ack(ctx);
    },
  ],
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

function replyEdit(field: OperatorEditField): PromptHandler {
  return async ({ chatId, replyToMessageId, text }) => {
    const value = text.trim();
    if ((field === 'name' || field === 'contact') && !value) {
      await sendMessage(
        chatId,
        '⚠️ Значение не может быть пустым. Попробуйте ещё раз.',
      );
      return;
    }
    let before: string | null | undefined;
    const updated = await resolvePendingPrompt(
      chatId,
      replyToMessageId,
      (lead) => {
        before = lead[field];
        return { [field]: value || null } as Partial<StoredLead>;
      },
    );
    if (updated) {
      await ensureLeadCard(updated);
      await sendFieldChangeToAdmin(updated, field, before);
      await replyWithCard(chatId, updated, '✅ Обновлено');
    }
  };
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

async function replyCorrectPayout({
  role,
  chatId,
  replyToMessageId,
  messageId,
  text,
  pending,
}: PromptReply): Promise<void> {
  const amount = parseAmount(text, true);
  if (amount == null) {
    await sendMessage(chatId, PAYOUT_COPY.invalidAmount);
    return;
  }
  await resolvePendingPrompt(chatId, replyToMessageId, () => ({}));
  const outcome = await correctPayout(
    pending.pendingPrompt?.payoutId ?? 0,
    amount,
    role,
  );
  if (!outcome.ok) {
    if (outcome.reason === 'settled')
      await sendMessage(chatId, PAYOUT_COPY.settled);
    return;
  }
  await sendPayoutNotificationToAdmin(pending, outcome.payout);
  await sendPayoutRecorded(chatId, messageId, outcome.payout);
}

const PROMPT_REPLIES: Record<PromptKind, PromptHandler> = {
  deal_amount: replyDealAmount,
  add_income: replyAddIncome,
  postpone: replyPostpone,
  reply_visitor: replyVisitor,
  edit_name: replyEdit('name'),
  edit_contact: replyEdit('contact'),
  edit_comment: replyEdit('comment'),
  correct_payout: replyCorrectPayout,
};

type Reply = Omit<PromptReply, 'pending'>;

async function replyToPrompt(reply: Reply): Promise<boolean> {
  const pending = await findByPendingPrompt(
    reply.chatId,
    reply.replyToMessageId,
  );
  if (!pending?.pendingPrompt) return false;
  await PROMPT_REPLIES[pending.pendingPrompt.kind]({ ...reply, pending });
  return true;
}

async function replyToCard(reply: Reply): Promise<boolean> {
  const lead = await findByCard(reply.chatId, reply.replyToMessageId);
  if (!lead) return false;
  const text = reply.text.trim();
  if (!text) return true;
  await touchLead(lead.id);
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

const REPLY_ROUTES = [replyToPrompt, replyToCard];

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
  await routeReply({
    role,
    chatId: ctx.chat.id,
    messageId: ctx.message.message_id,
    replyToMessageId: repliedTo.message_id,
    text: ctx.message.text ?? '',
  });
});

bot
  .chatType('private')
  .on('message', (ctx) => handlePrivateMessage(ctx.message));

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
