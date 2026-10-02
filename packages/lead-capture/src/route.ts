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

const NEXT_STEP: Record<CaptureStep, CaptureStep | null> = {
  looking_for: 'budget',
  budget: null,
  phone: null,
};

export interface CaptureCopy {
  greeting: string;
  lookingFor: string;
  budget: string;
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

function question(step: CaptureStep, copy: CaptureCopy): string {
  return step === 'budget' ? copy.budget : copy.lookingFor;
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
    const lead = await store.insertLead({
      brand,
      name: senderName(sender),
      contact: senderContact(sender),
      service,
      services: service ? [service] : [],
      contactChannel: 'telegram',
      comment: telegramIdNote(sender.id),
      country: null,
      source_url: null,
      visitorId: null,
      locale,
      kind: 'lead',
      capturePrompt: { chatId, step: 'looking_for' },
    });
    await ensureLeadCard(lead);
    await bot.sendMessage(
      chatId,
      `${words.greeting}\n\n${question('looking_for', words)}`,
    );
  }

  async function answer(
    lead: StoredLead,
    prompt: CapturePrompt,
    text: string,
  ): Promise<void> {
    const next = NEXT_STEP[prompt.step];
    const words = copy(isLocale(lead.locale) ? lead.locale : primaryLocale);
    const updated = await store.updateCapture(lead.id, {
      note: `${ANSWER_NOTE[prompt.step]}: ${text}`,
      capturePrompt: next ? { chatId: prompt.chatId, step: next } : null,
    });
    await ensureLeadCard(updated ?? lead);
    await bot.sendMessage(
      prompt.chatId,
      next ? question(next, words) : words.thanks,
    );
  }

  async function handle(
    chatId: number,
    sender: CaptureSender,
    text: string,
  ): Promise<void> {
    const started = START_PATTERN.exec(text);
    if (started) return start(chatId, sender, started[1]);

    const lead = await store.findByCapturePrompt(chatId);
    if (lead?.capturePrompt) return answer(lead, lead.capturePrompt, text);
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

    const text = message.text?.trim() ?? '';
    if (!text) return ACK;

    try {
      await handle(message.chat.id, message.from, text);
    } catch (error) {
      console.error('[capture] could not handle the update', { error });
    }
    return ACK;
  };
}
