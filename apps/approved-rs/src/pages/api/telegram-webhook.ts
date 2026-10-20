export const prerender = false;

import type { APIContext } from 'astro';
import { Composer, type Context } from 'grammy';
import { z } from 'zod';
import { parse, isValid, format } from 'date-fns';
import { START_COMMAND } from '@podbor/site-kit/contact-links';
import { secretMatches } from '@/lib/verifySecret';
import {
  afterStatusChange,
  answerCallback,
  bot,
  sendForceReplyPrompt,
  safeEditMessage,
  sendOperationNotice,
  sendMessage,
  buildBalance,
  LEDGER_COPY,
  operationRecordedText,
  operationRefusedText,
  reAskOperationText,
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
  dropFromDigest,
  OWNER_IDS,
  ADMIN_IDS,
  GROUP_ID,
  REPLY_COPY,
  LEAD_ACTION_COPY,
  EDIT_COPY,
  noteLine,
  reAskEditText,
  sendFieldChange,
  sendNoteNotice,
  extraContactNote,
  renameLeadTopic,
  touchLeadTopic,
  ensureLeadCard,
  ensureLeadTopic,
  type EditField,
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
  resolvePendingPrompt,
  findByTopic,
  recordOwnerReply,
  searchLeads,
  resumeLead,
  postponeLead,
  canPostpone,
  appendNote,
  editedContact,
  hasRealContact,
  postponePatch,
  readLeads,
  readBalance,
  readOperations,
  openOperationPrompt,
  findOperationPrompt,
  answerOperationPrompt,
  parseOperationReply,
  businessDay,
  LedgerUnreadableError,
  MAX_FIELD_LENGTH,
  type OperationType,
  type LeadStatus,
  type PendingPrompt,
  type PromptKey,
  type StoredLead,
} from '@/lib/store';

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

const PHONE_REGION = 'RS';

const messageSchema = z.object({
  message_id: z.number().int(),
  text: z.string().optional(),
  chat: z.object({ id: z.number().int(), type: z.string().optional() }),
  message_thread_id: z.number().int().optional(),
  from: z
    .object({ id: z.number().int(), is_bot: z.boolean().optional() })
    .optional(),
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

function parseReminderDate(text: string): string | null {
  const parsed = parse(text.trim(), 'dd.MM.yyyy', new Date());
  if (!isValid(parsed)) return null;
  const day = format(parsed, 'yyyy-MM-dd');
  return day < businessDay(new Date()) ? null : day;
}

type Ctx = {
  chatId: number;
  messageId: number;
  role: Role;
  authorId: number;
  cbId: string;
  message: unknown;
};
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
    const text =
      err instanceof LedgerUnreadableError
        ? LEDGER_COPY.unavailable
        : LEAD_ACTION_COPY.failed;
    await answerCallback(cbId, text).catch(() => {});
  }
}

function onGroupCard(ctx: Ctx, lead: StoredLead): boolean {
  return (
    ctx.chatId === lead.telegramChatId &&
    ctx.messageId === lead.telegramMessageId
  );
}

function authorOf({ role, authorId }: Ctx) {
  return { role, id: authorId };
}

async function afterStatusChangeOn(
  ctx: Ctx,
  updated: StoredLead,
): Promise<void> {
  const { chatId, messageId, role } = ctx;
  await afterStatusChange(updated, {
    author: authorOf(ctx),
    ...(onGroupCard(ctx, updated)
      ? {}
      : { surface: { chatId, messageId, role } }),
  });
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
  const updated = lead.status === key ? lead : await setStatus(id, key);
  if (updated && updated !== lead)
    await (fromDetail
      ? afterStatusChangeOn(ctx, updated)
      : afterStatusChange(updated, { author: authorOf(ctx) }));
  await answerCallback(
    ctx.cbId,
    updated ? LEAD_ACTION_COPY.statusUpdated : LEAD_ACTION_COPY.closed,
  );
}

async function markInWork(ctx: Ctx, id: number): Promise<void> {
  const lead = await getLead(id);
  if (lead?.status !== 'in_progress')
    return changeStatus(ctx, id, 'in_progress', false);
  await touchLead(id);
  await dropFromDigest(id);
  await answerCallback(ctx.cbId, LEAD_ACTION_COPY.inWork);
}

async function openRemindPicker(ctx: Ctx, id: number): Promise<void> {
  const lead = await getLead(id);
  if (!lead) return ack(ctx);
  if (!canPostpone(lead))
    return answerCallback(ctx.cbId, LEAD_ACTION_COPY.notPostponable);
  const { text, reply_markup } = buildRemindPicker(id);
  await safeEditMessage(ctx.chatId, ctx.messageId, text, reply_markup);
  await answerCallback(ctx.cbId);
}

async function remindIn(ctx: Ctx, id: number, days: string): Promise<void> {
  const remindAt = businessDay(new Date(), Number(days));
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
  if (lead && onGroupCard(ctx, lead)) {
    await ensureLeadCard(lead);
  } else if (lead) {
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
  await dropFromDigest(id);
  await safeEditMessage(ctx.chatId, ctx.messageId, LEAD_ACTION_COPY.deleted, {
    inline_keyboard: [],
  });
  await answerCallback(ctx.cbId, LEAD_ACTION_COPY.deleteAck);
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
  replacing?: PromptKey,
): Promise<void> {
  const messageId = await sendForceReplyPrompt(chatId, text);
  await openOperationPrompt({ chatId, messageId, type }, replacing);
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

async function startTopic(ctx: Ctx, id: number): Promise<void> {
  const lead = await getLead(id);
  if (!lead) return ack(ctx);
  const opened =
    lead.topicId != null
      ? lead
      : await ensureLeadTopic(lead).catch((error: unknown) => {
          console.error('[telegram-webhook] could not open the topic', {
            error,
            leadId: id,
          });
          return lead;
        });
  if (opened.topicId == null)
    return answerCallback(ctx.cbId, LEAD_ACTION_COPY.topicFailed);
  await ensureLeadCard(opened);
  const onGroupCard =
    ctx.chatId === opened.telegramChatId &&
    ctx.messageId === opened.telegramMessageId;
  if (!onGroupCard)
    await editLeadDetailMessage(ctx.chatId, ctx.messageId, opened, ctx.role);
  await answerCallback(ctx.cbId, LEAD_ACTION_COPY.topicOpened);
}

function editRow(field: EditField): CallbackRow {
  return [
    new RegExp(`^edit:(\\d+):${field}$`),
    'any',
    withId((ctx, id) =>
      startLeadPrompt(ctx, id, {
        prompt: EDIT_COPY.prompt(field),
        kind: `edit_${field}`,
        ackText: EDIT_COPY.ack,
      }),
    ),
  ];
}

function statusRow(key: LeadStatus): CallbackRow {
  return [
    new RegExp(`^st:(\\d+):${key}$`),
    'any',
    withId((ctx, id) => changeStatus(ctx, id, key)),
  ];
}

export const CALLBACKS: CallbackRow[] = [
  statusRow('won'),
  statusRow('lost'),
  statusRow('negotiations'),
  statusRow('in_progress'),
  [
    /^won:(\d+)$/,
    'any',
    withId((ctx, id) => changeStatus(ctx, id, 'won', false)),
  ],
  [
    /^lost:(\d+)$/,
    'any',
    withId((ctx, id) => changeStatus(ctx, id, 'lost', false)),
  ],
  [
    /^talk:(\d+)$/,
    'any',
    withId((ctx, id) => changeStatus(ctx, id, 'negotiations', false)),
  ],
  [/^work:(\d+)$/, 'any', withId(markInWork)],
  [/^postpone:(\d+)$/, 'any', withId(openRemindPicker)],
  [/^remindpick:(\d+):(\d+)$/, 'any', withId(remindIn)],
  [
    /^remindtype:(\d+)$/,
    'any',
    withId((ctx, id) =>
      startLeadPrompt(ctx, id, {
        prompt: LEAD_ACTION_COPY.remindPrompt,
        kind: 'postpone',
        ackText: LEAD_ACTION_COPY.remindAck,
      }),
    ),
  ],
  [/^remindcancel:(\d+)$/, 'any', withId(backToLead)],
  [/^resume:(\d+)$/, 'any', withId(resume)],
  [/^del:(\d+)$/, 'admin', withId(askDelete)],
  [/^delconfirm:(\d+)$/, 'admin', withId(confirmDelete)],
  [/^delcancel:(\d+)$/, 'admin', withId(backToLead)],
  [/^menu:open$/, 'any', listOpen],
  [/^open:(\d+)$/, 'any', withId(openLead)],
  [/^topic:(\d+)$/, 'any', withId(startTopic)],
  editRow('name'),
  editRow('contact'),
  [
    /^note:(\d+)$/,
    'any',
    withId((ctx, id) =>
      startLeadPrompt(ctx, id, {
        prompt: EDIT_COPY.notePrompt,
        kind: 'note',
        ackText: EDIT_COPY.noteAck,
      }),
    ),
  ],
  [
    /^menu:stats$/,
    'admin',
    async (ctx) => {
      const [leads, operations] = await Promise.all([
        readLeads(),
        readOperations(),
      ]);
      await sendMessage(ctx.chatId, buildStats(leads, operations, new Date()));
      await ack(ctx);
    },
  ],
  // TODO: drop once no chat still shows a menu with the old 💰 debt button (menus sent before #240).
  [/^menu:debt$/, 'any', showBalance],
  operationRow('payout'),
  operationRow('settlement'),
];

function callbackCtx(cb: {
  id: string;
  from?: { id: number };
  message?: { message_id: number; chat: { id: number } };
}): Ctx | undefined {
  const authorId = cb.from?.id;
  const role = roleOf(authorId);
  if (!cb.message || !role || authorId == null) return undefined;
  return {
    chatId: cb.message.chat.id,
    messageId: cb.message.message_id,
    role,
    authorId,
    cbId: cb.id,
    message: cb.message,
  };
}

const callbacks = new Composer<CrmContext>();

for (const [pattern, needed, handler] of CALLBACKS) {
  callbacks.callbackQuery(pattern, ({ crm, match, callbackQuery }) =>
    needed !== 'any' && needed !== crm.role
      ? answerCallback(crm.cbId, LEAD_ACTION_COPY.roleOnly[needed]).catch(
          () => {},
        )
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

type Reply = {
  role: Role;
  authorId: number;
  chatId: number;
  messageId: number;
  replyToMessageId: number;
  text: string;
  inPrivateChat: boolean;
};

type PromptHandler = (reply: Reply, lead: StoredLead) => Promise<void>;

async function replyPostpone({
  role,
  authorId,
  chatId,
  replyToMessageId,
  text,
}: Reply): Promise<void> {
  const remindAt = parseReminderDate(text);
  if (remindAt == null) {
    await sendMessage(chatId, LEAD_ACTION_COPY.badDate);
    return;
  }
  const updated = await resolvePendingPrompt(
    { chatId, messageId: replyToMessageId },
    (lead) =>
      canPostpone(lead)
        ? postponePatch(
            lead,
            remindAt,
            `${LEAD_ACTION_COPY.postponedUntil}${formatDateRu(remindAt)}`,
          )
        : {},
  );
  if (!updated) return;
  if (updated.status === 'postponed')
    await afterStatusChange(updated, { author: { role, id: authorId } });
  else await sendMessage(chatId, LEAD_ACTION_COPY.notPostponable);
}

function threadedTo(messageId: number) {
  return {
    reply_parameters: {
      message_id: messageId,
      allow_sending_without_reply: true,
    },
  };
}

function promptKey({ chatId, replyToMessageId }: Reply): PromptKey {
  return { chatId, messageId: replyToMessageId };
}

async function afterEdit(
  reply: Reply,
  lead: StoredLead,
  headline: string,
): Promise<void> {
  await afterStatusChange(lead);
  const { text, reply_markup } = buildLeadDetail(lead, reply.role);
  await sendMessage(reply.chatId, `${headline}\n\n${text}`, { reply_markup });
}

async function reAskEdit(
  reply: Reply,
  id: number,
  field: EditField | 'note',
): Promise<void> {
  const messageId = await sendForceReplyPrompt(
    reply.chatId,
    reAskEditText(field),
  );
  await setPendingPrompt(id, {
    chatId: reply.chatId,
    messageId,
    kind: field === 'note' ? field : `edit_${field}`,
  });
}

const replyName: PromptHandler = async (reply, lead) => {
  const name = reply.text.trim().slice(0, MAX_FIELD_LENGTH);
  if (!name) return reAskEdit(reply, lead.id, 'name');
  let before = '';
  const updated = await resolvePendingPrompt(promptKey(reply), (current) => {
    before = current.name;
    return { name };
  });
  if (!updated) return;
  await renameLeadTopic(updated);
  await afterEdit(reply, updated, EDIT_COPY.updated);
  await sendFieldChange(updated, 'name', before, reply.role, reply.authorId);
};

const replyContact: PromptHandler = async (reply, lead) => {
  const edited = editedContact(reply.text, lead.contactChannel, PHONE_REGION);
  if (!edited) return reAskEdit(reply, lead.id, 'contact');
  let before = '';
  let noted = false;
  const updated = await resolvePendingPrompt(promptKey(reply), (current) => {
    before = current.contact;
    noted = hasRealContact(current.contact);
    if (!noted) return edited;
    const line = noteLine(extraContactNote(edited.contact), reply.role);
    return { comment: appendNote(current.comment, line) };
  });
  if (!updated) return;
  if (noted) {
    await afterEdit(reply, updated, EDIT_COPY.contactNoted);
    await sendNoteNotice(
      updated,
      extraContactNote(edited.contact),
      reply.role,
      reply.authorId,
    );
    return;
  }
  await afterEdit(reply, updated, EDIT_COPY.updated);
  await sendFieldChange(updated, 'contact', before, reply.role, reply.authorId);
};

const replyNote: PromptHandler = async (reply, lead) => {
  const text = reply.text.trim();
  if (!text) return reAskEdit(reply, lead.id, 'note');
  const updated = await resolvePendingPrompt(promptKey(reply), (current) => ({
    comment: appendNote(current.comment, noteLine(text, reply.role)),
  }));
  if (!updated) return;
  await afterEdit(reply, updated, LEAD_ACTION_COPY.noteAdded);
  await sendNoteNotice(updated, text, reply.role, reply.authorId);
};

const PROMPT_REPLIES: Record<PromptKind, PromptHandler> = {
  postpone: replyPostpone,
  edit_name: replyName,
  edit_contact: replyContact,
  note: replyNote,
};

async function replyToPrompt(reply: Reply): Promise<boolean> {
  const pending = await findByPendingPrompt(promptKey(reply));
  const kind = pending?.pendingPrompt?.kind;
  if (!pending || !kind) return false;
  await PROMPT_REPLIES[kind](reply, pending);
  return true;
}

async function findLiveOperationPrompt(reply: Reply, key: PromptKey) {
  try {
    return await findOperationPrompt(key);
  } catch (err) {
    if (!(err instanceof LedgerUnreadableError)) throw err;
    await sendMessage(reply.chatId, LEDGER_COPY.unavailable);
    return 'unavailable';
  }
}

async function replyToOperationPrompt(reply: Reply): Promise<boolean> {
  if (!reply.inPrivateChat) return false;
  const key = { chatId: reply.chatId, messageId: reply.replyToMessageId };
  const prompt = await findLiveOperationPrompt(reply, key);
  if (prompt === 'unavailable') return true;
  if (!prompt) return false;
  if (prompt.expired) {
    await sendMessage(reply.chatId, LEDGER_COPY.expired);
    return true;
  }
  const parsed = parseOperationReply(reply.text);
  if (!parsed.ok) {
    await askOperation(
      reply.chatId,
      prompt.type,
      reAskOperationText(prompt.type, parsed.reason),
      key,
    );
    return true;
  }
  const outcome = await answerOperationPrompt(key, {
    amount: parsed.amount,
    note: parsed.note,
    by: reply.role,
  });
  if (outcome.ok) {
    await sendMessage(
      reply.chatId,
      operationRecordedText(outcome.operation, outcome.balance),
      threadedTo(reply.messageId),
    );
    await sendOperationNotice(
      outcome.operation,
      outcome.balance,
      reply.authorId,
    );
  } else if (outcome.reason === 'insufficient') {
    await askOperation(
      reply.chatId,
      prompt.type,
      operationRefusedText(prompt.type, outcome.balance),
      key,
    );
  } else {
    await sendMessage(reply.chatId, LEDGER_COPY.expired);
  }
  return true;
}

const REPLY_ROUTES = [replyToPrompt, replyToOperationPrompt];

async function routeReply(reply: Reply): Promise<boolean> {
  for (const route of REPLY_ROUTES) if (await route(reply)) return true;
  return false;
}

async function readBalanceIfReadable(): Promise<number | undefined> {
  try {
    return await readBalance();
  } catch (err) {
    if (err instanceof LedgerUnreadableError) return undefined;
    throw err;
  }
}

async function sendMenuMessage(chatId: number, role: Role): Promise<void> {
  const menu = buildMenu(role, await readBalanceIfReadable());
  await sendMessage(chatId, menu.text, { reply_markup: menu.reply_markup });
}

async function handlePrivateMessage(msg: TelegramMessage): Promise<void> {
  const chatId = msg.chat.id;
  const role = roleOf(msg.from?.id);
  const text = (msg.text ?? '').trim();

  const startMatch = START_COMMAND.exec(text);
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
    await ctx.answerCallbackQuery().catch((error: unknown) => {
      console.error('[telegram-webhook] could not answer the tap', { error });
    });
    return;
  }
  await callbacks.middleware()(Object.assign(ctx, { crm }), next);
});

async function deliverToVisitor(
  lead: StoredLead,
  chatId: number,
  messageId: number,
): Promise<boolean> {
  const client = captureClientFor(lead.brand);
  if (lead.telegramId == null || !client) {
    console.warn('[telegram-webhook] topic message has no route', {
      id: lead.id,
      brand: lead.brand,
      reason: client ? 'no telegramId' : 'no capture bot for brand',
    });
    return false;
  }
  try {
    await client.api.copyMessage(lead.telegramId, chatId, messageId);
    return true;
  } catch (err) {
    console.error('[telegram-webhook] topic message not delivered', {
      id: lead.id,
      error: err,
    });
    return false;
  }
}

type TopicMessage = {
  chatId: number;
  messageId: number;
  topicId: number;
  author: { role: Role; id: number };
};

async function relayTopicMessage(
  lead: StoredLead,
  { chatId, messageId, topicId, author }: TopicMessage,
): Promise<void> {
  await touchLeadTopic(lead);
  if (!(await deliverToVisitor(lead, chatId, messageId))) {
    await sendMessage(chatId, REPLY_COPY.undelivered, {
      message_thread_id: topicId,
      ...threadedTo(messageId),
    });
    return;
  }
  const updated = await recordOwnerReply(lead.id);
  if (updated && updated.status !== lead.status)
    await afterStatusChange(updated, { author });
}

bot.on(
  [
    'message:text',
    'message:file',
    'message:contact',
    'message:location',
    'message:poll',
    'message:dice',
  ],
  async (ctx, next) => {
    const topicId = ctx.message.message_thread_id;
    const role = roleOf(ctx.from?.id);
    if (
      topicId == null ||
      String(ctx.chat.id) !== GROUP_ID ||
      ctx.from?.is_bot ||
      !role ||
      !ctx.from
    )
      return next();
    const lead = await findByTopic(topicId);
    if (!lead) return next();
    await relayTopicMessage(lead, {
      chatId: ctx.chat.id,
      messageId: ctx.message.message_id,
      topicId,
      author: { role, id: ctx.from.id },
    });
  },
);

bot.on('message', async (ctx, next) => {
  const repliedTo = ctx.message.reply_to_message;
  if (!repliedTo) return next();
  const role = roleOf(ctx.from?.id);
  if (!role || !ctx.from) return next();
  const routed = await routeReply({
    role,
    authorId: ctx.from.id,
    chatId: ctx.chat.id,
    inPrivateChat: ctx.chat.type === 'private',
    messageId: ctx.message.message_id,
    replyToMessageId: repliedTo.message_id,
    text: ctx.message.text ?? '',
  });
  if (!routed) await next();
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
