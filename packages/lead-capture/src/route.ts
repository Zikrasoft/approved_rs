import { z } from 'zod';
import {
  secretMatches,
  telegramIdNote,
  type LeadStore,
  type StoredLead,
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

export type CaptureStore = Pick<LeadStore, 'insertLead'>;

export interface CaptureWebhookRouteOptions {
  secret: string | undefined;
  store: CaptureStore;
  ensureLeadCard: (lead: StoredLead) => Promise<void>;
  brand: string;
  isService: (value: string) => boolean;
  isLocale: (value: string) => boolean;
  primaryLocale: string;
}

function senderName(sender: CaptureSender): string {
  return [sender.first_name, sender.last_name].filter(Boolean).join(' ').trim();
}

function senderContact(sender: CaptureSender): string {
  return sender.username ? `@${sender.username}` : `tg://user?id=${sender.id}`;
}

export function createCaptureWebhookRoute({
  secret,
  store,
  ensureLeadCard,
  brand,
  isService,
  isLocale,
  primaryLocale,
}: CaptureWebhookRouteOptions) {
  function startFields(
    payload: string | undefined,
    sender: CaptureSender,
  ): { service: string; locale: string } {
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
    sender: CaptureSender,
    payload: string | undefined,
  ): Promise<void> {
    const { service, locale } = startFields(payload, sender);
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
    });
    await ensureLeadCard(lead);
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

    const started = START_PATTERN.exec(message.text?.trim() ?? '');
    if (!started) return ACK;

    try {
      await start(message.from, started[1]);
    } catch (error) {
      console.error('[capture] could not handle the update', { error });
    }
    return ACK;
  };
}
