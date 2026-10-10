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
  sendOperationNotice,
  sendMessage,
  buildBalance,
  LEDGER_COPY,
  operationRecordedText,
  operationRefusedText,
  reAskOperationText,
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
  LEAD_ACTION_COPY,
  SETTLEMENT_COPY,
  settleKeyboard,
  settlementText,
  escapeHtml,
  type Role,
} from '@/lib/telegram';
import { captureClientFor } from '@/lib/captureBot';
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
  resolvePendingPrompt,
  searchLeads,
  resumeLead,
  postponeLead,
  canPostpone,
  postponePatch,
  addPayout,
  getBalance,
  addSettlement,
  addSettlePrompt,
  findSettlePrompt,
  settleBalance,
  isSettled,
  readLeads,
  appendNote,
  readBalance,
  openOperationPrompt,
  findOperationPrompt,
  answerOperationPrompt,
  parseOperationReply,
  type OperationType,
  type LeadStatus,
  type PendingPrompt,
  type Payout,
  type Settlement,
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

const MAX_PAYOUT_AMOUNT = 1_000_000;

const AMOUNT_NOISE = {
  prompt: /[^\d.,-]/g,
  plain: /\s+|(?:€|eur|евро)\.?$/gi,
};

function amountSchema(noise: RegExp) {
  return z
    .string()
    .transform((text) =>
      text.replace(noise, '').replace(/\.$/, '').replace(',', '.'),
    )
    .pipe(z.string().regex(/^\d+(\.\d+)?$/))
    .transform(Number)
    .pipe(z.number().max(MAX_PAYOUT_AMOUNT));
}

const AMOUNT_SCHEMAS = {
  prompt: amountSchema(AMOUNT_NOISE.prompt),
  plain: amountSchema(AMOUNT_NOISE.plain),
};

function parseAmount(
  text: string,
  {
    mode = 'prompt',
    allowZero = false,
  }: { mode?: keyof typeof AMOUNT_SCHEMAS; allowZero?: boolean } = {},
): number | null {
  const parsed = AMOUNT_SCHEMAS[mode].safeParse(text);
  if (!parsed.success) return null;
  return parsed.data > 0 || (allowZero && parsed.data === 0)
    ? parsed.data
    : null;
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
type IdHandler = (ctx: Ctx, id: number, ...rest: string[]) => Promise<void>;
type CallbackRow = [RegExp, Role | 'any', Handler];
type PromptKind = PendingPrompt['kind'];

function withId(handler: IdHandler): Handler {
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
    await answerCallback(cbId, LEAD_ACTION_COPY.failed).catch(() => {});
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
  if (key !== 'won')
    return answerCallback(ctx.cbId, LEAD_ACTION_COPY.statusUpdated);
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
    `${LEAD_ACTION_COPY.postponedUntil}${formatDateRu(remindAt)}`,
  );
  if (!updated) return ack(ctx);
  await afterStatusChangeOn(ctx, updated);
  await answerCallback(ctx.cbId, LEAD_ACTION_COPY.postponed);
}

async function resume(ctx: Ctx, id: number): Promise<void> {
  const updated = await resumeLead(id);
  if (!updated) return ack(ctx);
  await afterStatusChangeOn(ctx, updated);
  await answerCallback(ctx.cbId, LEAD_ACTION_COPY.resumed);
}

async function backToLead(ctx: Ctx, id: number): Promise<void> {
  const lead = await getLead(id);
  if (lead) {
    await editLeadDetailMessage(ctx.chatId, ctx.messageId, lead, ctx.role);
  } else {
    await safeEditMessage(
      ctx.chatId,
      ctx.messageId,
      LEAD_ACTION_COPY.notFound,
      { inline_keyboard: [] },
    );
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
  await safeEditMessage(ctx.chatId, ctx.messageId, LEAD_ACTION_COPY.deleted, {
    inline_keyboard: [],
  });
  await answerCallback(ctx.cbId, LEAD_ACTION_COPY.deleteAck);
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

async function showBalance(ctx: Ctx): Promise<void> {
  const { text, reply_markup } = buildBalance(ctx.role, await readBalance());
  await sendMessage(ctx.chatId, text, { reply_markup });
  await ack(ctx);
}

async function askOperation(
  chatId: number,
  type: OperationType,
  text: string = LEDGER_COPY.prompt[type],
): Promise<void> {
  const messageId = await sendForceReplyPrompt(chatId, text);
  await openOperationPrompt({ chatId, messageId, type });
}

function operationRow(type: OperationType): CallbackRow {
  return [
    new RegExp(`^ledger:${type}$`),
    'any',
    async (ctx) => {
      await askOperation(ctx.chatId, type);
      await answerCallback(ctx.cbId, LEDGER_COPY.ack);
    },
  ];
}

const leadOf = async (leadId: number | null) =>
  leadId == null ? undefined : getLead(leadId);

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
  const messageId = await sendForceReplyPrompt(
    ctx.chatId,
    SETTLEMENT_COPY.prompt,
  );
  await addSettlePrompt({ chatId: ctx.chatId, messageId });
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
    withId((ctx, id) => changeStatus(ctx, id, key)),
  ];
}

export const CALLBACKS: CallbackRow[] = [
  statusRow('won'),
  statusRow('lost'),
  [
    /^won:(\d+)$/,
    'owner',
    withId((ctx, id) => changeStatus(ctx, id, 'won', false)),
  ],
  [
    /^lost:(\d+)$/,
    'owner',
    withId((ctx, id) => changeStatus(ctx, id, 'lost', false)),
  ],
  [/^work:(\d+)$/, 'owner', withId(markInWork)],
  [/^postpone:(\d+)$/, 'owner', withId(openRemindPicker)],
  [/^remindpick:(\d+):(\d+)$/, 'owner', withId(remindIn)],
  [
    /^remindtype:(\d+)$/,
    'owner',
    withId((ctx, id) =>
      startLeadPrompt(ctx, id, {
        prompt: LEAD_ACTION_COPY.remindPrompt,
        kind: 'postpone',
        ackText: LEAD_ACTION_COPY.remindAck,
      }),
    ),
  ],
  [/^remindcancel:(\d+)$/, 'owner', withId(backToLead)],
  [/^resume:(\d+)$/, 'any', withId(resume)],
  [/^del:(\d+)$/, 'admin', withId(askDelete)],
  [/^delconfirm:(\d+)$/, 'admin', withId(confirmDelete)],
  [/^delcancel:(\d+)$/, 'admin', withId(backToLead)],
  [/^payfix:(\d+)$/, 'any', withId(askPayoutFix)],
  [/^settle:other$/, 'admin', askSettlement],
  [/^settle:(\d+(?:\.\d+)?)$/, 'admin', settle],
  [
    /^reply:(\d+)$/,
    'any',
    withId((ctx, id) =>
      startLeadPrompt(ctx, id, {
        prompt: REPLY_COPY.prompt,
        kind: 'reply_visitor',
        ackText: REPLY_COPY.ack,
      }),
    ),
  ],
  [/^menu:open$/, 'any', listOpen],
  [/^open:(\d+)$/, 'any', withId(openLead)],
  [
    /^menu:stats$/,
    'admin',
    async (ctx) => {
      await sendMessage(ctx.chatId, buildStats(await readLeads()));
      await ack(ctx);
    },
  ],
  [/^menu:debt$/, 'any', showBalance],
  operationRow('payout'),
  operationRow('settlement'),
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
  const amount = parseAmount(text, { allowZero: true });
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

async function replyPostpone({
  chatId,
  replyToMessageId,
  text,
}: PromptReply): Promise<void> {
  const remindAt = parseReminderDate(text);
  if (remindAt == null) {
    await sendMessage(chatId, LEAD_ACTION_COPY.badDate);
    return;
  }
  const updated = await resolvePendingPrompt(
    chatId,
    replyToMessageId,
    (lead) =>
      canPostpone(lead)
        ? postponePatch(
            lead,
            remindAt,
            `${LEAD_ACTION_COPY.postponedUntil}${formatDateRu(remindAt)}`,
          )
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
  postpone: replyPostpone,
  reply_visitor: replyVisitor,
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

async function replyToPayoutPrompt(reply: Reply): Promise<boolean> {
  const payout = await findPayoutByPrompt(reply.chatId, reply.replyToMessageId);
  if (!payout) return false;
  const amount = parseAmount(reply.text, { allowZero: true });
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

async function replyToCard(reply: Reply): Promise<boolean> {
  const lead = await findByCard(reply.chatId, reply.replyToMessageId);
  if (!lead) return false;
  const text = reply.text.trim();
  if (!text) return true;
  const amount = parseAmount(text, { mode: 'plain', allowZero: true });
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
  const prompt = { chatId: reply.chatId, messageId: reply.replyToMessageId };
  if (!(await findSettlePrompt(prompt.chatId, prompt.messageId))) return false;
  if (reply.role !== 'admin') return true;
  const amount = parseAmount(reply.text);
  if (amount == null) {
    await sendMessage(reply.chatId, PAYOUT_COPY.invalidAmount);
    return true;
  }
  const settlement = await addSettlement(amount, prompt);
  await sendMessage(
    reply.chatId,
    await recordedSettlement(settlement),
    threadedTo(reply.messageId),
  );
  return true;
}

async function replyToOperationPrompt(reply: Reply): Promise<boolean> {
  const key = { chatId: reply.chatId, messageId: reply.replyToMessageId };
  const prompt = await findOperationPrompt(key);
  if (!prompt) return false;
  const parsed = parseOperationReply(reply.text);
  if (!parsed) {
    await askOperation(
      reply.chatId,
      prompt.type,
      reAskOperationText(prompt.type),
    );
    return true;
  }
  const outcome = await answerOperationPrompt(key, {
    ...parsed,
    by: reply.role,
  });
  if (outcome.ok) {
    await sendMessage(
      reply.chatId,
      operationRecordedText(outcome.operation, outcome.balance),
      threadedTo(reply.messageId),
    );
    await sendOperationNotice(outcome.operation, outcome.balance);
  } else if (outcome.reason === 'insufficient') {
    await sendMessage(reply.chatId, operationRefusedText(outcome.balance));
  }
  return true;
}

const REPLY_ROUTES = [
  replyToOperationPrompt,
  replyToPrompt,
  replyToPayoutPrompt,
  replyToSettlementPrompt,
  replyToCard,
];

async function routeReply(reply: Reply): Promise<void> {
  for (const route of REPLY_ROUTES) if (await route(reply)) return;
}

async function sendMenuMessage(chatId: number, role: Role): Promise<void> {
  const menu = buildMenu(role, await readBalance());
  await sendMessage(chatId, menu.text, { reply_markup: menu.reply_markup });
}

async function handlePrivateMessage(msg: TelegramMessage): Promise<void> {
  const chatId = msg.chat.id;
  const role = roleOf(msg.from?.id);
  const text = (msg.text ?? '').trim();

  const startMatch = /^\/start(?:\s+(\S+))?$/.exec(text);
  if (startMatch || text === '/menu') {
    if (!role) {
      await sendMessage(chatId, LEAD_ACTION_COPY.denied);
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
    await sendMessage(chatId, LEAD_ACTION_COPY.denied);
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
