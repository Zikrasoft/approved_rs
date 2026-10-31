import { checkoutContactSchema } from '@podbor/catalog-contract';
import { z } from 'zod';

import { filled } from './line-metadata';

type Metadata = Record<string, unknown> | null | undefined;

export type CheckoutContactFields = z.output<typeof checkoutContactSchema>;

export const MAX_HANDOFF_ATTEMPTS = 6;

const CASH_AT_PICKUP = 'cash_at_pickup';

const KEYS = {
  fulfillment: 'fulfillment',
  handedOffAt: 'lead_handed_off_at',
  handoffError: 'lead_handoff_error',
  handoffAttempts: 'lead_handoff_attempts',
  ownerAlertedAt: 'lead_owner_alerted_at',
  lostAt: 'lead_lost_at',
  lostError: 'lead_lost_error',
  lostAttempts: 'lead_lost_attempts',
  cancelRefusedAt: 'lead_cancel_refused_at',
  cancelAlertedAt: 'lead_cancel_alerted_at',
} as const;

export const cashAtPickupMetadata = () => ({
  [KEYS.fulfillment]: CASH_AT_PICKUP,
});

export const checkoutMetadata = (
  current: Metadata,
  contact: CheckoutContactFields,
  car: string | null,
): Record<string, unknown> => ({ ...current, ...contact, car });

const attemptsSchema = z.coerce.number().int().nonnegative().catch(0);

const attemptsAt = (metadata: Metadata, key: string): number =>
  attemptsSchema.parse(metadata?.[key] ?? 0);

const leadStatus = (metadata: Metadata) => {
  const attempts = attemptsAt(metadata, KEYS.handoffAttempts);
  return {
    handed_off_at: filled.parse(metadata?.[KEYS.handedOffAt]),
    attempts,
    error: filled.parse(metadata?.[KEYS.handoffError]),
    gave_up: attempts >= MAX_HANDOFF_ATTEMPTS,
    alerted_at: filled.parse(metadata?.[KEYS.ownerAlertedAt]),
  };
};

const cancelStatus = (metadata: Metadata) => ({
  lost_at: filled.parse(metadata?.[KEYS.lostAt]),
  error: filled.parse(metadata?.[KEYS.lostError]),
  attempts: attemptsAt(metadata, KEYS.lostAttempts),
  refused_at: filled.parse(metadata?.[KEYS.cancelRefusedAt]),
  alerted_at: filled.parse(metadata?.[KEYS.cancelAlertedAt]),
});

export type LeadStatus = ReturnType<typeof leadStatus>;

export function readOrder(metadata: Metadata) {
  const contact = checkoutContactSchema.safeParse(metadata ?? {});
  const cashAtPickup = metadata?.[KEYS.fulfillment] === CASH_AT_PICKUP;
  const lead = leadStatus(metadata);
  return {
    contact: contact.success ? contact.data : null,
    cashAtPickup,
    lead,
    cancel: cancelStatus(metadata),
    needsAttention: cashAtPickup && !lead.handed_off_at,
  };
}

export const leadStamp = {
  handedOff: (at: string) => ({
    [KEYS.handedOffAt]: at,
    [KEYS.handoffError]: '',
    [KEYS.handoffAttempts]: '',
  }),
  handOffFailed: (reason: string, attempts: number) => ({
    [KEYS.handoffError]: reason,
    [KEYS.handoffAttempts]: attempts,
  }),
  ownerAlerted: (at: string) => ({ [KEYS.ownerAlertedAt]: at }),
  lost: (at: string) => ({ [KEYS.lostAt]: at, [KEYS.lostError]: '' }),
  lostUndone: () => ({ [KEYS.lostAt]: '' }),
  lostFailed: (reason: string, attempts: number) => ({
    [KEYS.lostError]: reason,
    [KEYS.lostAttempts]: attempts,
  }),
  cancelRefused: (at: string) => ({ [KEYS.cancelRefusedAt]: at }),
  cancelAlerted: (at: string) => ({ [KEYS.cancelAlertedAt]: at }),
};
