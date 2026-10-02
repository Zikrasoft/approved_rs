import { z } from 'zod';
import {
  secretMatches,
  telegramIdNote,
  type CapturePrompt,
  type LeadStore,
  type StoredLead,
  type TelegramClient,
} from '@podbor/lead-crm';
import { captureUpdateSchema, type CaptureSender } from './update.ts';

const ACK = new Response(null, { status: 200 });
const UNAUTHORIZED = new Response(null, { status: 401 });

const SECRET_HEADER = 'x-telegram-bot-api-secret-token';
const START_PATTERN = /^\/start(?:\s+(\S+))?$/;
const MAX_START_PAYLOAD = 64;

const webhookSecretSchema = z.string().min(1);

const startPayloadSchema = z
  .string()
  .max(MAX_START_PAYLOAD)
  .regex(/^[A-Za-z0-9_-]+$/)
  .catch('');

type CaptureStep = CapturePrompt['step'];

const ANSWER_NOTE: Record<CaptureStep, string> = {
  looking_for: 'Ищет',
  budget: 'Бюджет',
  phone: 'Телефон',
};

const WITH_HANDLE: CaptureStep[] = ['looking_for', 'budget', 'phone'];
const WITHOUT_HANDLE: CaptureStep[] = ['phone', 'looking_for', 'budget'];

const CLEAR_KEYBOARD = { reply_markup: { remove_keyboard: true } };

export interface CaptureCopy {
  greeting: string;
  lookingFor: string;
  budget: string;
  phoneAsk: string;
  phoneOffer: string;
  phoneButton: string;
  phoneSkip: string;
  thanks: string;
}

export type CaptureStore = Pick<
  LeadStore,
  'insertLead' | 'findByCapturePrompt' | 'updateCapture'
>;

export interface CaptureWebhookRouteOptions<L extends string> {
  secret: string | undefined;
  store: CaptureStore;
  ensureLeadCard: (lead: StoredLead) => Promise<void>;
  bot: Pick<TelegramClient, 'sendMessage'>;
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

function order(contact: string): CaptureStep[] {
  return hasHandle(contact) ? WITH_HANDLE : WITHOUT_HANDLE;
}

function stepAfter(contact: string, step: CaptureStep): CaptureStep | null {
  const steps = order(contact);
  return steps[steps.indexOf(step) + 1] ?? null;
}

function phoneKeyboard(words: CaptureCopy) {
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
): [string, object | undefined] {
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

function sharedPhone(phoneNumber: string): string {
  return phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
}

export function createCaptureWebhookRoute<L extends string>({
  secret,
  store,
  ensureLeadCard,
  bot,
  brand,
  isService,
  isLocale,
  primaryLocale,
  copy,
}: CaptureWebhookRouteOptions<L>) {
  function startFields(
    payload: string | undefined,
    sender: CaptureSender,
  ): { service: string; locale: L } {
    const parts = startPayloadSchema.parse(payload).split('_');
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
    };
  }

  async function start(
    chatId: number,
    sender: CaptureSender,
    payload: string | undefined,
  ): Promise<void> {
    const { service, locale } = startFields(payload, sender);
    const words = copy(locale);
    const contact = senderContact(sender);
    const step = order(contact)[0];
    const lead = await store.insertLead({
      brand,
      name: senderName(sender),
      contact,
      service,
      services: service ? [service] : [],
      contactChannel: 'telegram',
      comment: telegramIdNote(sender.id),
      country: null,
      source_url: null,
      visitorId: null,
      locale,
      kind: 'lead',
      capturePrompt: { chatId, step },
    });
    await ensureLeadCard(lead);
    const [text, extra] = nextMessage(step, null, contact, words);
    await bot.sendMessage(chatId, `${words.greeting}\n\n${text}`, extra);
  }

  async function answer(
    lead: StoredLead,
    prompt: CapturePrompt,
    text: string | undefined,
    phone: string | undefined,
  ): Promise<void> {
    const words = copy(isLocale(lead.locale) ? lead.locale : primaryLocale);
    const keepsHandle = hasHandle(lead.contact);
    const takesPhone = prompt.step === 'phone' && phone !== undefined;
    const next = stepAfter(lead.contact, prompt.step);
    const updated = await store.updateCapture(lead.id, {
      note:
        prompt.step === 'phone'
          ? takesPhone && keepsHandle
            ? `${ANSWER_NOTE.phone}: ${phone}`
            : undefined
          : `${ANSWER_NOTE[prompt.step]}: ${text}`,
      contact: takesPhone && !keepsHandle ? phone : undefined,
      capturePrompt: next ? { chatId: prompt.chatId, step: next } : null,
    });
    await ensureLeadCard(updated ?? lead);
    const [reply, extra] = nextMessage(next, prompt.step, lead.contact, words);
    await bot.sendMessage(prompt.chatId, reply, extra);
  }

  async function handle(
    chatId: number,
    sender: CaptureSender,
    text: string | undefined,
    phone: string | undefined,
  ): Promise<void> {
    if (text !== undefined) {
      const started = START_PATTERN.exec(text);
      if (started) return start(chatId, sender, started[1]);
    }

    const lead = await store.findByCapturePrompt(chatId);
    const prompt = lead?.capturePrompt;
    if (!lead || !prompt) return;
    if (prompt.step !== 'phone' && text === undefined) return;
    return answer(lead, prompt, text, phone);
  }

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

    const { message } = captureUpdateSchema.parse(body);
    if (!message || message.chat.type !== 'private') return ACK;

    const trimmed = message.text?.trim();
    const text = trimmed ? trimmed : undefined;
    const phone = message.contact && sharedPhone(message.contact.phone_number);
    if (text === undefined && phone === undefined) return ACK;

    try {
      await handle(message.chat.id, message.from, text, phone);
    } catch (error) {
      console.error('[capture] could not handle the update', { error });
    }
    return ACK;
  };
}
