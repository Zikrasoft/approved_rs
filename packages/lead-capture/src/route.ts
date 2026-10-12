import type { Bot } from 'grammy';
import { z } from 'zod';
import {
  readStartVisitor,
  START_COMMAND,
  START_PAYLOAD_LIMIT,
} from '@podbor/site-kit/contact-links';
import {
  isHandleContact,
  isPhoneContact,
  isTelegramIdContact,
  secretMatches,
  isFreshLead,
  telegramIdContact,
  type CapturePrompt,
  type CaptureStep,
  type EditField,
  type LeadStore,
  type StoredLead,
} from '@podbor/lead-crm';
import { typedPhone, type PhoneRegion } from '@podbor/lead-crm/phone';
import type { CaptureCopy } from './copy.ts';
import {
  createScreens,
  REFERRAL,
  tapSchema,
  LANGUAGE_SWITCH_TAP,
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
const MENU_PATTERN = /^\/menu$/;
const LANG_PATTERN = /^\/lang$/;

const webhookSecretSchema = z.string().min(1);

const captureEnvSchema = z.object({
  TELEGRAM_CAPTURE_WEBHOOK_SECRET: webhookSecretSchema
    .optional()
    .catch(undefined),
});

export function captureWebhookSecret(
  env: Record<string, unknown>,
): string | undefined {
  return captureEnvSchema.parse(env).TELEGRAM_CAPTURE_WEBHOOK_SECRET;
}

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
  referred?: boolean;
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
  budget: (words) => budgetLine.parse(words.budget),
  car: (words) => words.request.car,
};

const MESSAGE_NOTE = 'Сообщение';

const budgetLine = z.string();

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

export interface CaptureWebhookRouteOptions<
  L extends string,
  S extends string,
> extends MenuConfig<L, S> {
  secret: string | undefined;
  store: CaptureStore;
  ensureLeadTopic: (lead: StoredLead) => Promise<StoredLead>;
  ensureLeadCard: (lead: StoredLead) => Promise<void>;
  sendVisitorChangeToAdmin: (
    lead: StoredLead,
    field: EditField,
    before: string | null | undefined,
  ) => Promise<void>;
  bot: Bot;
  brand: string;
  isLocale: (value: string) => value is L;
  primaryLocale: L;
  questionnaire: readonly Exclude<CaptureStep, 'phone'>[];
  phoneRegion: PhoneRegion;
}

function senderName(sender: CaptureSender): string {
  return [sender.first_name, sender.last_name].filter(Boolean).join(' ').trim();
}

function senderContact(sender: CaptureSender): string {
  return sender.username ? `@${sender.username}` : telegramIdContact(sender.id);
}

function phoneKeyboard(words: CaptureCopy): PhoneKeyboardExtra {
  return {
    reply_markup: {
      keyboard: [[{ text: words.phoneButton, request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  };
}

function phonePatch(
  lead: StoredLead,
  phone: string,
): { note?: string; contact?: string } {
  return isHandleContact(lead.contact)
    ? { note: `${ANSWER_NOTE.phone}: ${phone}` }
    : { contact: phone };
}

function sharedPhone(phoneNumber: string): string {
  return isPhoneContact(phoneNumber) ? phoneNumber : `+${phoneNumber}`;
}

export function createCaptureWebhookRoute<L extends string, S extends string>({
  secret,
  store,
  ensureLeadTopic,
  ensureLeadCard,
  sendVisitorChangeToAdmin,
  bot,
  brand,
  isLocale,
  primaryLocale,
  questionnaire,
  phoneRegion,
  ...menuConfig
}: CaptureWebhookRouteOptions<L, S>) {
  const { copy } = menuConfig;
  const {
    isService,
    mainMenu,
    service,
    contactsScreen,
    render,
    servicePicker,
    languagePicker,
  } = createScreens(menuConfig);

  function stepOrder(contact: string, picked: string): CaptureStep[] {
    const asked = questionnaire.filter((step) => step !== 'service' || !picked);
    return isTelegramIdContact(contact) ? [...asked, 'phone'] : asked;
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
    locale: L,
  ): [string, CaptureExtra] {
    const words = copy(locale);
    if (next === 'phone') return [words.phoneAsk, phoneKeyboard(words)];
    if (next === 'service')
      return [
        words.request.service,
        { reply_markup: { inline_keyboard: servicePicker(locale) } },
      ];
    return [next ? QUESTION[next](words) : words.thanks, undefined];
  }

  function send(chatId: number, text: string, extra?: CaptureExtra) {
    return bot.api.sendMessage(chatId, text, { parse_mode: 'HTML', ...extra });
  }

  async function show(chatId: number, screen: Screen): Promise<void> {
    await send(chatId, screen.text, {
      reply_markup: { inline_keyboard: screen.keyboard },
    });
  }

  async function ask(chatId: number, step: CaptureStep, locale: L) {
    const [text, extra] = nextMessage(step, locale);
    await send(chatId, text, extra);
  }

  async function dropPhoneKeyboard(
    chatId: number,
    ended: CapturePrompt | null,
    text: string,
  ): Promise<void> {
    if (ended?.step !== 'phone') return;
    const sent = await send(chatId, text, CLEAR_KEYBOARD);
    await bot.api.deleteMessage(chatId, sent.message_id);
  }

  async function publishLeadChange(
    lead: StoredLead,
    updated: StoredLead | undefined,
  ): Promise<void> {
    const latest = updated ?? lead;
    const topical = await ensureLeadTopic(latest).catch((error: unknown) => {
      console.error('[capture] could not update the topic', {
        error,
        leadId: lead.id,
      });
      return latest;
    });
    await ensureLeadCard(topical).catch((error: unknown) => {
      console.error('[capture] could not update the card', {
        error,
        leadId: lead.id,
      });
    });
    if (!updated) return;
    for (const field of VISITOR_FIELDS)
      await sendVisitorChangeToAdmin(updated, field, lead[field]);
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
      referred: head === REFERRAL,
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

  async function freshOpenLead(
    sender: CaptureSender,
  ): Promise<StoredLead | undefined> {
    const open = await store.findOpenLeadByTelegramId(sender.id, brand);
    return open && isFreshLead(open) ? open : undefined;
  }

  async function runningQuestionnaire(
    chatId: number,
  ): Promise<{ lead: StoredLead; prompt: CapturePrompt } | undefined> {
    const lead = await store.findByCapturePrompt(chatId, brand);
    return lead?.capturePrompt
      ? { lead, prompt: lead.capturePrompt }
      : undefined;
  }

  async function newLead(
    sender: CaptureSender,
    contact: string,
    { service: picked, locale, visitorId, referred }: StartFields<L, S>,
    comment: string | null,
    capturePrompt: CapturePrompt | null,
  ): Promise<void> {
    // TODO: merging before the click card saves its message id posts a second teaser.
    const { lead, before } = await store.insertOrMergeLead({
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
      referredBy: referred ? 'approved' : null,
      capturePrompt,
    });
    await (before
      ? publishLeadChange(before, lead)
      : publishLeadChange(lead, undefined));
  }

  async function start(
    chatId: number,
    sender: CaptureSender,
    payload: string | undefined,
    comment: string | null = null,
    contact?: string,
  ): Promise<void> {
    const fields = startFields(payload, sender);
    await newLead(
      sender,
      contact ?? (await contactOf(sender)),
      fields,
      comment,
      null,
    );
    const screen = startScreen(fields.locale, fields.service);
    const { greeting } = copy(fields.locale);
    await show(chatId, { ...screen, text: `${greeting}\n\n${screen.text}` });
  }

  async function recordAnswer(
    lead: StoredLead,
    prompt: CapturePrompt,
    text: string | undefined,
    picked?: S,
  ): Promise<void> {
    const next = stepAfter(lead, prompt.step);
    const updated = await store.updateCapture(lead.id, {
      note: picked ? undefined : `${ANSWER_NOTE[prompt.step]}: ${text}`,
      service: picked,
      capturePrompt: next ? { chatId: prompt.chatId, step: next } : null,
    });
    await publishLeadChange(lead, updated);
    const [reply, extra] = nextMessage(next, localeOf(lead));
    await send(prompt.chatId, reply, extra);
  }

  async function takePhone(
    lead: StoredLead,
    prompt: CapturePrompt,
    phone: string,
  ): Promise<void> {
    const updated = await store.updateCapture(lead.id, {
      ...phonePatch(lead, phone),
      capturePrompt: null,
    });
    await publishLeadChange(lead, updated);
    await send(prompt.chatId, copy(localeOf(lead)).thanks, CLEAR_KEYBOARD);
  }

  async function reAskPhone(
    lead: StoredLead,
    prompt: CapturePrompt,
    text: string,
  ): Promise<void> {
    const updated = await store.updateCapture(lead.id, {
      note: `${MESSAGE_NOTE}: ${text}`,
      capturePrompt: prompt,
    });
    await publishLeadChange(lead, updated);
    await ask(prompt.chatId, 'phone', localeOf(lead));
  }

  async function typedAnswer(
    lead: StoredLead,
    prompt: CapturePrompt,
    text: string,
  ): Promise<void> {
    if (prompt.step !== 'phone') return recordAnswer(lead, prompt, text);
    const phone = typedPhone(text, phoneRegion);
    return phone
      ? takePhone(lead, prompt, phone)
      : reAskPhone(lead, prompt, text);
  }

  async function startOrResume(
    chatId: number,
    sender: CaptureSender,
    payload: string | undefined,
  ): Promise<void> {
    const open = await freshOpenLead(sender);
    if (!open) return start(chatId, sender, payload);
    const locale = localeOf(open);
    const fields = startFields(payload, sender);
    if (fields.service || fields.referred)
      return resumeFromTile(chatId, open, fields, locale);
    if (open.capturePrompt) return ask(chatId, open.capturePrompt.step, locale);
    return show(chatId, mainMenu(locale));
  }

  async function resumeFromTile(
    chatId: number,
    open: StoredLead,
    { service: picked, referred }: StartFields<L, S>,
    locale: L,
  ): Promise<void> {
    const updated = await store.updateCapture(open.id, {
      service: picked,
      referredBy: referred ? 'approved' : undefined,
      capturePrompt: null,
    });
    await publishLeadChange(open, updated);
    const screen = startScreen(locale, picked);
    await dropPhoneKeyboard(chatId, open.capturePrompt, screen.text);
    await show(chatId, screen);
  }

  async function endQuestionnaire(chatId: number, text: string): Promise<void> {
    const running = await runningQuestionnaire(chatId);
    if (!running) return;
    await store.updateCapture(running.lead.id, { capturePrompt: null });
    await dropPhoneKeyboard(chatId, running.prompt, text);
  }

  async function openScreen(
    chatId: number,
    sender: CaptureSender,
    screen: (locale: L) => Screen,
  ) {
    const open = await store.findOpenLeadByTelegramId(sender.id, brand);
    const shown = screen(open ? localeOf(open) : senderLocale(sender));
    await endQuestionnaire(chatId, shown.text);
    await show(chatId, shown);
  }

  async function switchLocale(sender: CaptureSender, locale: L) {
    const open = await store.findOpenLeadByTelegramId(sender.id, brand);
    if (open && open.locale !== locale)
      await store.updateCapture(open.id, {
        locale,
        capturePrompt: open.capturePrompt,
      });
  }

  async function leaveRequest(
    chatId: number,
    sender: CaptureSender,
    locale: L,
    picked: S | '',
  ): Promise<void> {
    const open = await freshOpenLead(sender);
    if (!open) {
      const contact = await contactOf(sender);
      const step = firstStep(contact, picked);
      const fields = { service: picked, locale, visitorId: null };
      await newLead(sender, contact, fields, null, { chatId, step });
      return ask(chatId, step, locale);
    }
    const step = firstStep(open.contact, picked || open.service);
    const updated = await store.updateCapture(open.id, {
      service: picked,
      locale,
      capturePrompt: { chatId, step },
    });
    await publishLeadChange(open, updated);
    await ask(chatId, step, locale);
  }

  async function showContacts(chatId: number, locale: L): Promise<void> {
    const screen = contactsScreen(locale);
    await endQuestionnaire(chatId, screen.text);
    const { venue } = menuConfig.contacts;
    if (venue)
      await bot.api.sendVenue(
        chatId,
        venue.lat,
        venue.lon,
        venue.title,
        `${venue.street}, ${venue.city}`,
      );
    await show(chatId, screen);
  }

  async function pickService(chatId: number, picked: string): Promise<void> {
    const running = await runningQuestionnaire(chatId);
    if (running?.prompt.step !== 'service' || !isService(picked)) return;
    await recordAnswer(running.lead, running.prompt, undefined, picked);
  }

  async function handleTap(
    chatId: number,
    messageId: number,
    sender: CaptureSender,
    data: string,
  ): Promise<void> {
    const tap = tapSchema.parse(data);
    if (!tap) return;
    const locale = isLocale(tap.locale) ? tap.locale : primaryLocale;
    if (tap.screen === 'request') {
      if (tap.arg === '' || isService(tap.arg))
        await leaveRequest(chatId, sender, locale, tap.arg);
      return;
    }
    if (tap.screen === 'contacts') return showContacts(chatId, locale);
    if (tap.screen === 'pick') return pickService(chatId, tap.arg);
    const switchesLanguage = tap.screen === LANGUAGE_SWITCH_TAP;
    if (switchesLanguage && !isLocale(tap.locale)) return;
    const screen = switchesLanguage
      ? mainMenu(locale)
      : render(tap.screen, locale, tap.arg);
    if (!screen) return;
    await endQuestionnaire(chatId, screen.text);
    if (switchesLanguage) await switchLocale(sender, locale);
    await bot.api.editMessageText(chatId, messageId, screen.text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: screen.keyboard },
    });
  }

  async function recordFreeMessage(
    chatId: number,
    sender: CaptureSender,
    text: string,
  ): Promise<void> {
    const open = await freshOpenLead(sender);
    if (!open)
      return start(chatId, sender, undefined, `${MESSAGE_NOTE}: ${text}`);
    const updated = await store.updateCapture(open.id, {
      note: `${MESSAGE_NOTE}: ${text}`,
      capturePrompt: open.capturePrompt,
    });
    await publishLeadChange(open, updated);
    await send(chatId, copy(localeOf(open)).received);
  }

  async function recordPhoneOnOpenLead(
    chatId: number,
    lead: StoredLead,
    phone: string,
  ): Promise<void> {
    const updated = await store.updateCapture(lead.id, {
      ...phonePatch(lead, phone),
      capturePrompt: lead.capturePrompt,
    });
    await publishLeadChange(lead, updated);
    await send(chatId, copy(localeOf(lead)).received);
  }

  async function handleOwnContact(
    chatId: number,
    sender: CaptureSender,
    phone: string,
  ): Promise<void> {
    const running = await runningQuestionnaire(chatId);
    if (running?.prompt.step === 'phone')
      return takePhone(running.lead, running.prompt, phone);
    const open =
      running?.lead ?? (await store.findOpenLeadByTelegramId(sender.id, brand));
    if (open) return recordPhoneOnOpenLead(chatId, open, phone);
    if (sender.username)
      return start(chatId, sender, undefined, `${ANSWER_NOTE.phone}: ${phone}`);
    return start(chatId, sender, undefined, null, phone);
  }

  async function handleForeignContact(chatId: number): Promise<void> {
    const running = await runningQuestionnaire(chatId);
    if (running) await ask(chatId, running.prompt.step, localeOf(running.lead));
  }

  async function handleText(
    chatId: number,
    sender: CaptureSender,
    text: string,
  ): Promise<void> {
    const started = START_COMMAND.exec(text);
    if (started) return startOrResume(chatId, sender, started[1]);
    if (MENU_PATTERN.test(text)) return openScreen(chatId, sender, mainMenu);
    if (LANG_PATTERN.test(text))
      return openScreen(chatId, sender, languagePicker);

    const running = await runningQuestionnaire(chatId);
    if (running) return typedAnswer(running.lead, running.prompt, text);
    return recordFreeMessage(chatId, sender, text);
  }

  bot.chatType('private').on('message', async (ctx) => {
    const message = captureMessageSchema.safeParse(ctx.message);
    if (!message.success) return;
    const trimmed = message.data.text?.trim();
    const text = trimmed ? trimmed : undefined;
    const { chat, from, contact } = message.data;
    if (contact?.user_id === from.id)
      await handleOwnContact(chat.id, from, sharedPhone(contact.phone_number));
    else if (contact) await handleForeignContact(chat.id);
    else if (text !== undefined) await handleText(chat.id, from, text);
  });

  bot.chatType('private').on('callback_query:data', async (ctx) => {
    await ctx.answerCallbackQuery().catch((error: unknown) => {
      console.error('[capture] could not answer the tap', { error });
    });
    const tap = captureTapSchema.safeParse(ctx.callbackQuery);
    if (!tap.success) return;
    const { message, from, data } = tap.data;
    await handleTap(message.chat.id, message.message_id, from, data);
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
