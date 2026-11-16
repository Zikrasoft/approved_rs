import { z } from 'zod';
import { typedPhone, type PhoneRegion } from './phone.ts';
import {
  TELEGRAM_HANDLE,
  telegramContact,
  typedAsPhone,
} from './contactShape.ts';
import type { StoredLead } from './schema.ts';
import type { TrackedContactChannel } from './contactChannel.ts';

const PHONE_CHANNELS = [
  'phone',
  'whatsapp',
  'viber',
] as const satisfies TrackedContactChannel[];

const webContactSchema = z.union([
  z.email(),
  z.url({ protocol: /^https?$/, hostname: z.regexes.domain }),
]);

export type EditedContact = Pick<StoredLead, 'contact' | 'contactChannel'>;

export function editedContact(
  typed: string,
  channel: string | null | undefined,
  region: PhoneRegion,
): EditedContact | undefined {
  const text = typed.trim();
  if (typedAsPhone(text)) {
    const phone = typedPhone(text, region);
    if (!phone) return undefined;
    const kept = PHONE_CHANNELS.find((known) => known === channel) ?? 'phone';
    return { contact: phone, contactChannel: kept };
  }
  const handle = telegramContact(text);
  if (TELEGRAM_HANDLE.test(handle))
    return { contact: handle, contactChannel: 'telegram' };
  return webContactSchema.safeParse(text).success
    ? { contact: text, contactChannel: null }
    : undefined;
}
