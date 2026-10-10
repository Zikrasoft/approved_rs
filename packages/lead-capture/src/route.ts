import type { Bot } from 'grammy';
import { z } from 'zod';
import {
  readStartVisitor,
  START_PAYLOAD_LIMIT,
} from '@podbor/site-kit/contact-links';
import {
  secretMatches,
  VISITOR_MERGE_WINDOW_MS,
  type CapturePrompt,
  type EditField,
  type FieldChangeAuthor,
  type LeadStore,
  type StoredLead,
} from '@podbor/lead-crm';
import type { CaptureCopy } from './copy.ts';
import {
  captureMessageSchema,
  captureUpdateSchema,
  type CaptureSender,
} from './update.ts';

const ACK = new Response(null, { status: 200 });
const UNAUTHORIZED = new Response(null, { status: 401 });

const SECRET_HEADER = 'x-telegram-bot-api-secret-token';
const START_PATTERN = /^\/start(?:\s+(\S+))?$/;

const webhookSecretSchema = z.string().min(1);

const startPayloadSchema = z
  .string()
  .max(START_PAYLOAD_LIMIT)
  .regex(/^[A-Za-z0-9_-]+$/)
  .catch('')
  .transform(readStartVisitor);

type CaptureStep = CapturePrompt['step'];

const ANSWER_NOTE: Record<CaptureStep, string> = {
  looking_for: 'Ищет',
  budget: 'Бюджет',
  phone: 'Телефон',
};

const STEPS_WITH_HANDLE: CaptureStep[] = ['looking_for', 'budget', 'phone'];
const STEPS_WITHOUT_HANDLE: CaptureStep[] = ['phone', 'looking_for', 'budget'];

const MESSAGE_NOTE = 'Сообщение';

const VISITOR_FIELDS: EditField[] = ['contact', 'comment', 'service'];

interface PhoneKeyboardExtra {
  reply_markup: {
    keyboard: { text: string; request_contact?: true }[][];
    resize_keyboard: true;
    one_time_keyboard: true;
  };
}

interface ClearKeyboardExtra {
  reply_markup: { remove_keyboard: true };
}

type CaptureExtra = PhoneKeyboardExtra | ClearKeyboardExtra | undefined;

const CLEAR_KEYBOARD: ClearKeyboardExtra = {
  reply_markup: { remove_keyboard: true },
};

export type CaptureStore = Pick<
  LeadStore,
  | 'insertOrMergeLead'
  | 'findByCapturePrompt'
  | 'findOpenLeadByTelegramId'
  | 'findPhoneByTelegramId'
  | 'updateCapture'
>;

export function captureStore(store: LeadStore): CaptureStore {
  return {
    insertOrMergeLead: store.insertOrMergeLead,
    findByCapturePrompt: store.findByCapturePrompt,
    findOpenLeadByTelegramId: store.findOpenLeadByTelegramId,
    findPhoneByTelegramId: store.findPhoneByTelegramId,
    updateCapture: store.updateCapture,
  };
}

export interface CaptureWebhookRouteOptions<L extends string> {
  secret: string | undefined;
  store: CaptureStore;
  ensureLeadCard: (lead: StoredLead) => Promise<void>;
  sendFieldChangeToAdmin: (
    lead: StoredLead,
    field: EditField,
    before: string | null | undefined,
    author: FieldChangeAuthor,
  ) => Promise<void>;
  bot: Bot;
  brand: string;
  isService: (value: string) => boolean;
  isLocale: (value: string) => value is L;
  primaryLocale: L;
  copy: (locale: L) => CaptureCopy;
}

function senderName(sender: CaptureSender): string {
  return [sender.first_name, sender.last_name].filter(Boolean).join(' ').trim();
}

function senderContact(sender: CaptureSender): string {
  return sender.username ? `@${sender.username}` : `tg://user?id=${sender.id}`;
}

function hasHandle(contact: string): boolean {
  return contact.startsWith('@');
}

function stepOrder(contact: string): CaptureStep[] {
  return hasHandle(contact) ? STEPS_WITH_HANDLE : STEPS_WITHOUT_HANDLE;
}

function stepAfter(contact: string, step: CaptureStep): CaptureStep | null {
  const steps = stepOrder(contact);
  return steps[steps.indexOf(step) + 1] ?? null;
}

function phoneKeyboard(words: CaptureCopy): PhoneKeyboardExtra {
  return {
    reply_markup: {
      keyboard: [
        [{ text: words.phoneButton, request_contact: true }],
        [{ text: words.phoneSkip }],
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  };
}

function nextMessage(
  next: CaptureStep | null,
  leaving: CaptureStep | null,
  contact: string,
  words: CaptureCopy,
): [string, CaptureExtra] {
  if (next === 'phone')
    return [
      hasHandle(contact) ? words.phoneOffer : words.phoneAsk,
      phoneKeyboard(words),
    ];
  const extra = leaving === 'phone' ? CLEAR_KEYBOARD : undefined;
  if (next === 'looking_for') return [words.lookingFor, extra];
  if (next === 'budget') return [words.budget, extra];
  return [words.thanks, extra];
}

function answerNote(
  step: CaptureStep,
  words: CaptureCopy,
  keepsHandle: boolean,
  text: string | undefined,
  phone: string | undefined,
): string | undefined {
  if (step !== 'phone') return `${ANSWER_NOTE[step]}: ${text}`;
  if (phone !== undefined)
    return keepsHandle ? `${ANSWER_NOTE.phone}: ${phone}` : undefined;
  return text === words.phoneSkip ? undefined : `${MESSAGE_NOTE}: ${text}`;
}

function sharedPhone(phoneNumber: string): string {
  return phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
}

export function createCaptureWebhookRoute<L extends string>({
  secret,
  store,
  ensureLeadCard,
  sendFieldChangeToAdmin,
  bot,
  brand,
  isService,
  isLocale,
  primaryLocale,
  copy,
}: CaptureWebhookRouteOptions<L>) {
  function send(chatId: number, text: string, extra?: CaptureExtra) {
    return bot.api.sendMessage(chatId, text, { parse_mode: 'HTML', ...extra });
  }

  async function refresh(
    lead: StoredLead,
    updated: StoredLead | undefined,
  ): Promise<void> {
    await ensureLeadCard(updated ?? lead);
    if (!updated) return;
    for (const field of VISITOR_FIELDS)
      await sendFieldChangeToAdmin(updated, field, lead[field], 'visitor');
  }

  function startFields(
    payload: string | undefined,
    sender: CaptureSender,
  ): { service: string; locale: L; visitorId: string | null } {
    const start = startPayloadSchema.parse(payload);
    const parts = start.payload.split('_');
    const head = parts[0];
    const tail = parts[parts.length - 1];
    const fallback = sender.language_code ?? '';
    return {
      service: parts.length > 1 && isService(head) ? head : '',
      locale: isLocale(tail)
        ? tail
        : isLocale(fallback)
          ? fallback
          : primaryLocale,
      visitorId: start.visitorId,
    };
  }

  function localeOf(lead: StoredLead): L {
    return isLocale(lead.locale) ? lead.locale : primaryLocale;
  }

  async function start(
    chatId: number,
    sender: CaptureSender,
    payload: string | undefined,
    message?: string,
  ): Promise<void> {
    const { service, locale, visitorId } = startFields(payload, sender);
    const words = copy(locale);
    const known = sender.username
      ? undefined
      : await store.findPhoneByTelegramId(sender.id, brand);
    const contact = known ?? senderContact(sender);
    const step = known ? 'looking_for' : stepOrder(contact)[0];
    // TODO: merging before the click card saves its message id posts a second teaser.
    const { lead } = await store.insertOrMergeLead({
      brand,
      name: senderName(sender),
      contact,
      service,
      services: service ? [service] : [],
      contactChannel: 'telegram',
      comment: message ? `${MESSAGE_NOTE}: ${message}` : null,
      telegramId: sender.id,
      country: null,
      source_url: null,
      visitorId,
      locale,
      kind: 'lead',
      capturePrompt: { chatId, step },
    });
    await ensureLeadCard(lead);
    const [text, extra] = nextMessage(step, null, contact, words);
    await send(chatId, `${words.greeting}\n\n${text}`, extra);
  }

  async function answer(
    lead: StoredLead,
    prompt: CapturePrompt,
    text: string | undefined,
    phone: string | undefined,
  ): Promise<void> {
    const words = copy(localeOf(lead));
    const keepsHandle = hasHandle(lead.contact);
    const takesPhone = prompt.step === 'phone' && phone !== undefined;
    const next = stepAfter(lead.contact, prompt.step);
    const updated = await store.updateCapture(lead.id, {
      note: answerNote(prompt.step, words, keepsHandle, text, phone),
      contact: takesPhone && !keepsHandle ? phone : undefined,
      capturePrompt: next ? { chatId: prompt.chatId, step: next } : null,
    });
    await refresh(lead, updated);
    const [reply, extra] = nextMessage(next, prompt.step, lead.contact, words);
    await send(prompt.chatId, reply, extra);
  }

  async function resume(chatId: number, lead: StoredLead): Promise<void> {
    const words = copy(localeOf(lead));
    const prompt = lead.capturePrompt;
    const [reply, extra]: [string, CaptureExtra] = prompt
      ? nextMessage(prompt.step, null, lead.contact, words)
      : [words.thanks, undefined];
    await send(chatId, reply, extra);
  }

  async function startOrResume(
    chatId: number,
    sender: CaptureSender,
    payload: string | undefined,
  ): Promise<void> {
    const open = await store.findOpenLeadByTelegramId(sender.id, brand);
    const age = open ? Date.now() - new Date(open.createdAt).getTime() : 0;
    if (open && age < VISITOR_MERGE_WINDOW_MS) return resume(chatId, open);
    return start(chatId, sender, payload);
  }

  async function aside(
    chatId: number,
    sender: CaptureSender,
    text: string,
  ): Promise<void> {
    const open = await store.findOpenLeadByTelegramId(sender.id, brand);
    if (!open) return start(chatId, sender, undefined, text);
    const updated = await store.updateCapture(open.id, {
      note: `${MESSAGE_NOTE}: ${text}`,
      capturePrompt: open.capturePrompt,
    });
    await refresh(open, updated);
    await send(chatId, copy(localeOf(open)).received);
  }

  async function phoneAside(
    lead: StoredLead,
    prompt: CapturePrompt,
    phone: string,
  ): Promise<void> {
    const words = copy(localeOf(lead));
    const keepsHandle = hasHandle(lead.contact);
    const updated = await store.updateCapture(lead.id, {
      note: answerNote('phone', words, keepsHandle, undefined, phone),
      contact: keepsHandle ? undefined : phone,
      capturePrompt: prompt,
    });
    await refresh(lead, updated);
    await send(prompt.chatId, words.received);
  }

  async function handle(
    chatId: number,
    sender: CaptureSender,
    text: string | undefined,
    phone: string | undefined,
  ): Promise<void> {
    if (text !== undefined) {
      const started = START_PATTERN.exec(text);
      if (started) return startOrResume(chatId, sender, started[1]);
    }

    // TODO: a dialog abandoned long ago still answers here, so a question
    // typed weeks later lands as that step's answer; bound it on the Lead's
    // age if that shows up in the store.
    const lead = await store.findByCapturePrompt(chatId, brand);
    const prompt = lead?.capturePrompt;
    if (lead && prompt) {
      if (prompt.step !== 'phone' && phone !== undefined)
        return phoneAside(lead, prompt, phone);
      return answer(lead, prompt, text, phone);
    }

    if (text === undefined) return;
    return aside(chatId, sender, text);
  }

  bot.chatType('private').on('message', async (ctx) => {
    const message = captureMessageSchema.safeParse(ctx.message);
    if (!message.success) return;
    const trimmed = message.data.text?.trim();
    const text = trimmed ? trimmed : undefined;
    const contact = message.data.contact;
    const phone = contact && sharedPhone(contact.phone_number);
    if (text === undefined && phone === undefined) return;
    await handle(message.data.chat.id, message.data.from, text, phone);
  });

  return async function POST({
    request,
  }: {
    request: Request;
  }): Promise<Response> {
    const expected = webhookSecretSchema.safeParse(secret);
    if (
      !expected.success ||
      !secretMatches(request.headers.get(SECRET_HEADER), expected.data)
    )
      return UNAUTHORIZED;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return ACK;
    }

    const update = captureUpdateSchema.safeParse(body);
    if (!update.success) return ACK;

    try {
      await bot.handleUpdate(update.data);
    } catch (error) {
      console.error('[capture] could not handle the update', { error });
    }
    return ACK;
  };
}
