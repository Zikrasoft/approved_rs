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
  type CaptureStep,
  type EditField,
  type FieldChangeAuthor,
  type LeadStore,
  type StoredLead,
} from '@podbor/lead-crm';
import type { CaptureCopy } from './copy.ts';
import {
  createScreens,
  readTap,
  type MenuConfig,
  type Screen,
} from './menu.ts';
import {
  captureMessageSchema,
  captureTapSchema,
  captureUpdateSchema,
  type CaptureSender,
} from './update.ts';

const ACK = new Response(null, { status: 200 });
const UNAUTHORIZED = new Response(null, { status: 401 });

const SECRET_HEADER = 'x-telegram-bot-api-secret-token';
const START_PATTERN = /^\/start(?:\s+(\S+))?$/;
const MENU_PATTERN = /^\/menu$/;
const TELEGRAM_USER_LINK = 'tg://user?id=';

const webhookSecretSchema = z.string().min(1);

const startPayloadSchema = z
  .string()
  .max(START_PAYLOAD_LIMIT)
  .regex(/^[A-Za-z0-9_-]+$/)
  .catch('')
  .transform(readStartVisitor);

interface StartFields<L extends string, S extends string> {
  service: S | '';
  locale: L;
  visitorId: string | null;
}

const ANSWER_NOTE: Record<CaptureStep, string> = {
  looking_for: 'Ищет',
  budget: 'Бюджет',
  phone: 'Телефон',
  car_issue: 'Машина и проблема',
  car: 'Машина',
  service: 'Услуга',
};

const QUESTION: Record<
  Exclude<CaptureStep, 'phone' | 'service'>,
  (words: CaptureCopy) => string
> = {
  looking_for: (words) => words.lookingFor,
  car_issue: (words) => words.lookingFor,
  budget: (words) => words.budget,
  car: (words) => words.request.car,
};

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

interface InlineKeyboardExtra {
  reply_markup: { inline_keyboard: Screen['keyboard'] };
}

type CaptureExtra =
  PhoneKeyboardExtra | ClearKeyboardExtra | InlineKeyboardExtra | undefined;

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

export interface CaptureWebhookRouteOptions<
  L extends string,
  S extends string,
> extends MenuConfig<L, S> {
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
  isLocale: (value: string) => value is L;
  primaryLocale: L;
  questionnaire: readonly CaptureStep[];
}

function senderName(sender: CaptureSender): string {
  return [sender.first_name, sender.last_name].filter(Boolean).join(' ').trim();
}

function senderContact(sender: CaptureSender): string {
  return sender.username
    ? `@${sender.username}`
    : `${TELEGRAM_USER_LINK}${sender.id}`;
}

function hasHandle(contact: string): boolean {
  return contact.startsWith('@');
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

export function createCaptureWebhookRoute<L extends string, S extends string>({
  secret,
  store,
  ensureLeadCard,
  sendFieldChangeToAdmin,
  bot,
  brand,
  isLocale,
  primaryLocale,
  questionnaire,
  ...menuConfig
}: CaptureWebhookRouteOptions<L, S>) {
  const { copy } = menuConfig;
  const { isService, mainMenu, service, render, servicePicker } =
    createScreens(menuConfig);

  function stepOrder(contact: string, picked: string): CaptureStep[] {
    if (hasHandle(contact))
      return questionnaire.filter((step) => step !== 'service' || !picked);
    const asked = questionnaire.filter(
      (step) => step !== 'phone' && (step !== 'service' || !picked),
    );
    return contact.startsWith(TELEGRAM_USER_LINK) ? ['phone', ...asked] : asked;
  }

  function firstStep(contact: string, picked: string): CaptureStep {
    return stepOrder(contact, picked)[0];
  }

  function stepAfter(lead: StoredLead, step: CaptureStep): CaptureStep | null {
    const steps = stepOrder(lead.contact, lead.service);
    const at = steps.indexOf(step);
    return at < 0 ? null : (steps[at + 1] ?? null);
  }

  function nextMessage(
    next: CaptureStep | null,
    leaving: CaptureStep | null,
    contact: string,
    locale: L,
  ): [string, CaptureExtra] {
    const words = copy(locale);
    if (next === 'phone')
      return [
        hasHandle(contact) ? words.phoneOffer : words.phoneAsk,
        phoneKeyboard(words),
      ];
    if (next === 'service')
      return [
        words.request.service,
        { reply_markup: { inline_keyboard: servicePicker(locale) } },
      ];
    const extra = leaving === 'phone' ? CLEAR_KEYBOARD : undefined;
    return [next ? QUESTION[next](words) : words.thanks, extra];
  }

  function send(chatId: number, text: string, extra?: CaptureExtra) {
    return bot.api.sendMessage(chatId, text, { parse_mode: 'HTML', ...extra });
  }

  async function show(chatId: number, screen: Screen): Promise<void> {
    await bot.api.sendMessage(chatId, screen.text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: screen.keyboard },
    });
  }

  async function ask(
    chatId: number,
    step: CaptureStep,
    contact: string,
    locale: L,
  ): Promise<void> {
    const [text, extra] = nextMessage(step, null, contact, locale);
    await send(chatId, text, extra);
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
  ): StartFields<L, S> {
    const start = startPayloadSchema.parse(payload);
    const parts = start.payload.split('_');
    const head = parts[0];
    const tail = parts[parts.length - 1];
    return {
      service: parts.length > 1 && isService(head) ? head : '',
      locale: isLocale(tail) ? tail : senderLocale(sender),
      visitorId: start.visitorId,
    };
  }

  function senderLocale(sender: CaptureSender): L {
    const language = sender.language_code ?? '';
    return isLocale(language) ? language : primaryLocale;
  }

  function localeOf(lead: StoredLead): L {
    return isLocale(lead.locale) ? lead.locale : primaryLocale;
  }

  function startScreen(locale: L, picked: S | ''): Screen {
    return picked ? service(locale, picked) : mainMenu(locale);
  }

  async function contactOf(sender: CaptureSender): Promise<string> {
    const known = sender.username
      ? undefined
      : await store.findPhoneByTelegramId(sender.id, brand);
    return known ?? senderContact(sender);
  }

  async function newLead(
    sender: CaptureSender,
    contact: string,
    { service: picked, locale, visitorId }: StartFields<L, S>,
    comment: string | null,
    capturePrompt: CapturePrompt | null,
  ): Promise<void> {
    // TODO: merging before the click card saves its message id posts a second teaser.
    const { lead } = await store.insertOrMergeLead({
      brand,
      name: senderName(sender),
      contact,
      service: picked,
      services: picked ? [picked] : [],
      contactChannel: 'telegram',
      comment,
      telegramId: sender.id,
      country: null,
      source_url: null,
      visitorId,
      locale,
      kind: 'lead',
      capturePrompt,
    });
    await ensureLeadCard(lead);
  }

  async function start(
    chatId: number,
    sender: CaptureSender,
    payload: string | undefined,
    message?: string,
  ): Promise<void> {
    const fields = startFields(payload, sender);
    const contact = await contactOf(sender);
    const comment = message ? `${MESSAGE_NOTE}: ${message}` : null;
    await newLead(sender, contact, fields, comment, null);
    const screen = startScreen(fields.locale, fields.service);
    const { greeting } = copy(fields.locale);
    await show(chatId, { ...screen, text: `${greeting}\n\n${screen.text}` });
  }

  async function answer(
    lead: StoredLead,
    prompt: CapturePrompt,
    text: string | undefined,
    phone: string | undefined,
    picked?: S,
  ): Promise<void> {
    const locale = localeOf(lead);
    const words = copy(locale);
    const keepsHandle = hasHandle(lead.contact);
    const takesPhone = prompt.step === 'phone' && phone !== undefined;
    const next = stepAfter(lead, prompt.step);
    const updated = await store.updateCapture(lead.id, {
      note: picked
        ? undefined
        : answerNote(prompt.step, words, keepsHandle, text, phone),
      contact: takesPhone && !keepsHandle ? phone : undefined,
      service: picked,
      capturePrompt: next ? { chatId: prompt.chatId, step: next } : null,
    });
    await refresh(lead, updated);
    const [reply, extra] = nextMessage(next, prompt.step, lead.contact, locale);
    await send(prompt.chatId, reply, extra);
  }

  async function startOrResume(
    chatId: number,
    sender: CaptureSender,
    payload: string | undefined,
  ): Promise<void> {
    const open = await store.findOpenLeadByTelegramId(sender.id, brand);
    const age = open ? Date.now() - new Date(open.createdAt).getTime() : 0;
    if (!open || age >= VISITOR_MERGE_WINDOW_MS)
      return start(chatId, sender, payload);
    const locale = localeOf(open);
    if (open.capturePrompt)
      return ask(chatId, open.capturePrompt.step, open.contact, locale);
    return show(
      chatId,
      startScreen(locale, startFields(payload, sender).service),
    );
  }

  async function endQuestionnaire(chatId: number): Promise<void> {
    const running = await store.findByCapturePrompt(chatId, brand);
    if (running) await store.updateCapture(running.id, { capturePrompt: null });
  }

  async function openMenu(chatId: number, sender: CaptureSender) {
    await endQuestionnaire(chatId);
    const open = await store.findOpenLeadByTelegramId(sender.id, brand);
    await show(chatId, mainMenu(open ? localeOf(open) : senderLocale(sender)));
  }

  async function leaveRequest(
    chatId: number,
    sender: CaptureSender,
    locale: L,
    picked: S | '',
  ): Promise<void> {
    const open = await store.findOpenLeadByTelegramId(sender.id, brand);
    if (!open) {
      const contact = await contactOf(sender);
      const step = firstStep(contact, picked);
      const fields = { service: picked, locale, visitorId: null };
      await newLead(sender, contact, fields, null, { chatId, step });
      return ask(chatId, step, contact, locale);
    }
    const step = firstStep(open.contact, picked || open.service);
    const updated = await store.updateCapture(open.id, {
      service: picked,
      capturePrompt: { chatId, step },
    });
    await refresh(open, updated);
    await ask(chatId, step, open.contact, locale);
  }

  async function pickService(chatId: number, picked: string): Promise<void> {
    const lead = await store.findByCapturePrompt(chatId, brand);
    const prompt = lead?.capturePrompt;
    if (!lead || prompt?.step !== 'service' || !isService(picked)) return;
    await answer(lead, prompt, undefined, undefined, picked);
  }

  async function tapped(
    chatId: number,
    messageId: number,
    sender: CaptureSender,
    data: string,
  ): Promise<void> {
    const tap = readTap(data);
    if (!tap) return;
    const locale = isLocale(tap.locale) ? tap.locale : primaryLocale;
    if (tap.screen === 'request') {
      if (tap.arg === '' || isService(tap.arg))
        await leaveRequest(chatId, sender, locale, tap.arg);
      return;
    }
    if (tap.screen === 'pick') return pickService(chatId, tap.arg);
    const screen = render(tap.screen, locale, tap.arg);
    if (!screen) return;
    await endQuestionnaire(chatId);
    await bot.api.editMessageText(chatId, messageId, screen.text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: screen.keyboard },
    });
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
      if (MENU_PATTERN.test(text)) return openMenu(chatId, sender);
    }

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

  bot.chatType('private').on('callback_query:data', async (ctx) => {
    await ctx.answerCallbackQuery();
    const tap = captureTapSchema.safeParse(ctx.callbackQuery);
    if (!tap.success) return;
    const { message, from, data } = tap.data;
    await tapped(message.chat.id, message.message_id, from, data);
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
