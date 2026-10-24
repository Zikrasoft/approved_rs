import { z } from 'zod';
import { SERVICE_LABELS_RU, type LabelledService } from '@podbor/brands';
import { TRACKED_CONTACT_CHANNELS } from './contactChannel.ts';
import {
  MAX_COMMENT_LENGTH,
  MAX_FIELD_LENGTH,
  MAX_URL_LENGTH,
} from './limits.ts';
import { isValidContact } from './phone.ts';
import { adSourceSchema, metaIdsSchema } from './schema.ts';
import {
  AD_SOURCE_FIELD,
  HONEYPOT_FIELD,
  META_IDS_FIELD,
  ORDER_ID_FIELD,
  SERVICE_FIELD,
} from './fields.ts';

export {
  isValidContact,
  PHONE_COUNTRIES,
  phoneCountryOptions,
} from './phone.ts';
export type { PhoneCountry, PhoneCountryOption } from './phone.ts';

export {
  MAX_COMMENT_LENGTH,
  MAX_FIELD_LENGTH,
  MAX_URL_LENGTH,
} from './limits.ts';
export const MAX_SERVICES = 20;
export {
  AD_SOURCE_FIELD,
  HONEYPOT_FIELD,
  META_IDS_FIELD,
  ORDER_ID_FIELD,
  SERVICE_FIELD,
} from './fields.ts';

export const contactChannelSchema = z.enum(TRACKED_CONTACT_CHANNELS);

export const serviceSlugSchema = z.enum(
  Object.keys(SERVICE_LABELS_RU) as [LabelledService, ...LabelledService[]],
);

const VISITOR_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const visitorIdSchema = z
  .string()
  .trim()
  .regex(VISITOR_ID)
  .nullable()
  .catch(null);

const cappedText = (max: number) =>
  z
    .string()
    .trim()
    .transform((value) => value.slice(0, max));

const requiredText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.slice(0, max));

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .nullish()
    .transform((value) => value?.slice(0, max) || null)
    .catch(null);

export const sourceUrlSchema = optionalText(MAX_URL_LENGTH);

function parseJson(value: unknown): unknown {
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

export const adSourceFieldSchema = z
  .preprocess(parseJson, adSourceSchema.nullable())
  .catch(null);

export const metaIdsFieldSchema = z
  .preprocess(parseJson, metaIdsSchema.nullable())
  .catch(null);

function formRecord(value: unknown): unknown {
  if (!(value instanceof FormData)) return value;
  const record: Record<string, unknown> = Object.create(null);
  value.forEach((entry, key) => {
    if (!(key in record)) record[key] = entry;
  });
  record[SERVICE_FIELD] = value.getAll(SERVICE_FIELD);
  return record;
}

const envelopeShape = {
  locale: z.string().trim().optional().catch(undefined),
  [HONEYPOT_FIELD]: z.string().trim().optional().catch('spam'),
};

export const leadEnvelopeSchema = z
  .preprocess(formRecord, z.object(envelopeShape))
  .catch({});

const submissionObject = z
  .object({
    ...envelopeShape,
    name: cappedText(MAX_FIELD_LENGTH),
    contact: requiredText(MAX_FIELD_LENGTH),
    contact_channel: z
      .union([contactChannelSchema, z.literal('')])
      .nullish()
      .transform((value) => value || null),
    service: z.array(z.union([serviceSlugSchema, z.literal('')])).default([]),
    // TODO: no form posts `car` since the CarLab field was folded into the comment; drop it once pre-deploy cached pages can no longer submit.
    car: optionalText(MAX_FIELD_LENGTH),
    vin: optionalText(MAX_FIELD_LENGTH),
    comment: optionalText(MAX_COMMENT_LENGTH),
    country: optionalText(MAX_FIELD_LENGTH),
    source_url: sourceUrlSchema,
    visitor_id: visitorIdSchema,
    [AD_SOURCE_FIELD]: adSourceFieldSchema,
    [META_IDS_FIELD]: metaIdsFieldSchema,
    [ORDER_ID_FIELD]: optionalText(MAX_FIELD_LENGTH),
    // TODO: LeadForm.astro posts `city` on every city landing page and it is discarded here.
    consent: z.string().trim().min(1),
  })
  .refine((value) => isValidContact(value.contact, value.contact_channel), {
    path: ['contact'],
  })
  .transform((value) => {
    const services = value.service.filter(Boolean).slice(0, MAX_SERVICES);
    const vin = value.vin ? `VIN: ${value.vin}` : null;
    const comment = [vin, value.car, value.comment]
      .filter(Boolean)
      .join('\n')
      .replace(/\r\n?/g, '\n');
    return {
      name: value.name,
      contact: value.contact,
      contactChannel: value.contact_channel,
      service: services[0] ?? '',
      services,
      comment: comment || null,
      country: value.country,
      source_url: value.source_url,
      visitorId: value.visitor_id,
      adSource: value[AD_SOURCE_FIELD],
      metaIds: value[META_IDS_FIELD],
      orderId: value[ORDER_ID_FIELD],
    };
  });

export const leadSubmissionSchema = z.preprocess(formRecord, submissionObject);

export type LeadFormSubmission = z.infer<typeof leadSubmissionSchema>;
