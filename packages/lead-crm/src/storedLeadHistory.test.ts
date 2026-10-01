import { describe, expect, it } from 'vitest';
import { createLeadSchema, type StoredLead } from './schema.ts';

// TODO: read these from @podbor/brands once lead-crm may depend on it.
const BRAND_COMMISSION_PERCENT = {
  'Approved.rs': 10,
  CarLab: 10,
  Details: 10,
} as const;

interface StoredShape {
  label: string;
  record: unknown;
  keeps: Partial<StoredLead>;
}

interface RefusedShape {
  label: string;
  record: unknown;
}

const HISTORY: StoredShape[] = [
  {
    label:
      'v0: no brand, no services, no incomes, a reminder stamp and a prompt kind that have both been retired',
    record: {
      id: 1,
      name: 'Иван',
      contact: '+381601234567',
      service: 'podbor-auto',
      contactChannel: 'telegram',
      comment: 'Ищу Golf 7',
      country: 'RS',
      source_url: 'https://approved.rs/ru/',
      visitorId: 'v-0001',
      locale: 'ru',
      kind: 'lead',
      status: 'in_progress',
      dealAmount: null,
      commissionPercent: 10,
      paidAmount: 0,
      payments: [],
      telegramChatId: -1001234567890,
      telegramMessageId: 42,
      statusChangedAt: '2026-03-09T10:00:00.000Z',
      lastRemindedAt: null,
      createdAt: '2026-03-09T09:00:00.000Z',
      pendingPrompt: {
        chatId: -1001234567890,
        messageId: 42,
        kind: 'commission_claim',
      },
      archived: false,
      customerPaidAt: null,
      pendingCommissionClaim: null,
    },
    keeps: {
      id: 1,
      brand: 'Approved.rs',
      name: 'Иван',
      contact: '+381601234567',
      service: 'podbor-auto',
      services: [],
      locale: 'ru',
      kind: 'lead',
      status: 'in_progress',
      dealAmount: null,
      paidAmount: 0,
      commissionPercent: 10,
      incomes: [],
      telegramChatId: -1001234567890,
      pendingPrompt: null,
      remindAt: null,
      postponedFrom: null,
    },
  },
  {
    label:
      'v3: an archived won lead carrying a customer-paid stamp and a claim with no income ids',
    record: {
      id: 2,
      name: '',
      contact: '@katya',
      service: 'inspection',
      locale: 'en',
      kind: 'lead',
      status: 'won',
      dealAmount: 0,
      commissionPercent: 10,
      paidAmount: 0,
      payments: [],
      telegramChatId: null,
      telegramMessageId: null,
      statusChangedAt: '2026-03-09T12:00:00.000Z',
      createdAt: '2026-03-08T12:00:00.000Z',
      pendingPrompt: null,
      archived: true,
      customerPaidAt: '2026-03-09T12:00:00.000Z',
      pendingCommissionClaim: {
        amount: 30,
        claimedAt: '2026-03-09T12:00:00.000Z',
      },
    },
    keeps: {
      id: 2,
      brand: 'Approved.rs',
      name: '',
      locale: 'en',
      status: 'won',
      archived: true,
      dealAmount: 0,
      incomes: [],
      pendingCommissionClaim: {
        amount: 30,
        claimedAt: '2026-03-09T12:00:00.000Z',
        incomeIds: [],
      },
    },
  },
  {
    label:
      'v4: a postponed lead with a reminder date and no memory of the status it left',
    record: {
      id: 3,
      name: 'Milan',
      contact: 'milan@example.rs',
      service: 'brakes-suspension',
      contactChannel: 'email',
      locale: 'sr',
      kind: 'lead',
      status: 'postponed',
      dealAmount: null,
      commissionPercent: 10,
      paidAmount: 0,
      payments: [],
      telegramChatId: -1001234567890,
      telegramMessageId: 77,
      statusChangedAt: '2026-03-10T08:00:00.000Z',
      createdAt: '2026-03-09T20:00:00.000Z',
      remindAt: '2026-03-20',
      pendingPrompt: null,
      archived: false,
      pendingCommissionClaim: null,
    },
    keeps: {
      id: 3,
      brand: 'Approved.rs',
      locale: 'sr',
      status: 'postponed',
      remindAt: '2026-03-20',
      postponedFrom: null,
    },
  },
  {
    label: 'v6: a locale only one of the three brands serves',
    record: {
      id: 4,
      name: 'Jonas',
      contact: '+4915112345678',
      service: 'podbor-auto',
      country: 'DE',
      locale: 'de',
      kind: 'lead',
      status: 'negotiations',
      dealAmount: null,
      commissionPercent: 10,
      paidAmount: 0,
      payments: [],
      telegramChatId: null,
      telegramMessageId: null,
      statusChangedAt: '2026-09-10T08:00:00.000Z',
      createdAt: '2026-09-10T08:00:00.000Z',
      remindAt: null,
      pendingPrompt: null,
      archived: false,
      pendingCommissionClaim: null,
    },
    keeps: {
      id: 4,
      brand: 'Approved.rs',
      locale: 'de',
      country: 'DE',
      status: 'negotiations',
    },
  },
  {
    label: 'v8: a lead another brand wrote into the shared store',
    record: {
      id: 5,
      brand: 'CarLab',
      name: 'Nikola',
      contact: '+381641112233',
      service: 'parts-order',
      contactChannel: 'viber',
      locale: 'sr',
      kind: 'lead',
      status: 'new',
      source_url: 'https://carlab.rs/sr/cart/',
      visitorId: null,
      dealAmount: null,
      commissionPercent: 10,
      paidAmount: 0,
      payments: [],
      telegramChatId: null,
      telegramMessageId: null,
      statusChangedAt: '2026-09-12T08:00:00.000Z',
      createdAt: '2026-09-12T08:00:00.000Z',
      remindAt: null,
      pendingPrompt: null,
      archived: false,
      pendingCommissionClaim: null,
    },
    keeps: {
      id: 5,
      brand: 'CarLab',
      service: 'parts-order',
      services: [],
      locale: 'sr',
      status: 'new',
      source_url: 'https://carlab.rs/sr/cart/',
    },
  },
  {
    label:
      'v9: every service a multi-select form sent, beside the single one it still writes',
    record: {
      id: 6,
      brand: 'Details',
      name: 'Ana',
      contact: '@ana_ns',
      service: 'polishing',
      services: ['polishing', 'ceramic-coating', 'ppf'],
      locale: 'sr',
      kind: 'lead',
      status: 'new',
      source_url: 'https://details.rs/sr/',
      dealAmount: null,
      commissionPercent: 10,
      paidAmount: 0,
      payments: [],
      incomes: [],
      telegramChatId: null,
      telegramMessageId: null,
      statusChangedAt: '2026-09-13T08:00:00.000Z',
      createdAt: '2026-09-13T08:00:00.000Z',
      remindAt: null,
      pendingPrompt: null,
      archived: false,
      pendingCommissionClaim: null,
    },
    keeps: {
      id: 6,
      brand: 'Details',
      service: 'polishing',
      services: ['polishing', 'ceramic-coating', 'ppf'],
    },
  },
  {
    label: 'pre-v10 money, settled in full: payments and no incomes',
    record: {
      id: 7,
      brand: 'Approved.rs',
      name: 'Petar',
      contact: '+381601112233',
      service: 'podbor-auto',
      locale: 'ru',
      kind: 'lead',
      status: 'won',
      dealAmount: 300,
      commissionPercent: 10,
      paidAmount: 30,
      payments: [{ amount: 30, at: '2026-03-15T10:00:00.000Z' }],
      telegramChatId: null,
      telegramMessageId: null,
      statusChangedAt: '2026-03-14T10:00:00.000Z',
      createdAt: '2026-03-01T10:00:00.000Z',
      remindAt: null,
      pendingPrompt: null,
      archived: false,
      pendingCommissionClaim: null,
    },
    keeps: {
      id: 7,
      dealAmount: 300,
      paidAmount: 30,
      commissionPercent: 10,
      incomes: [
        {
          id: 1,
          amount: 300,
          at: '2026-03-14T10:00:00.000Z',
          paidAt: '2026-03-15T10:00:00.000Z',
        },
      ],
    },
  },
  {
    label:
      'pre-v10 money, part paid: one deal splits into a settled and an unsettled income',
    record: {
      id: 8,
      brand: 'Approved.rs',
      name: 'Dragan',
      contact: '+381602223344',
      service: 'podbor-auto',
      locale: 'ru',
      kind: 'lead',
      status: 'won',
      dealAmount: 300,
      commissionPercent: 10,
      paidAmount: 12,
      payments: [{ amount: 12, at: '2026-03-16T10:00:00.000Z' }],
      telegramChatId: null,
      telegramMessageId: null,
      statusChangedAt: '2026-03-14T10:00:00.000Z',
      createdAt: '2026-03-02T10:00:00.000Z',
      remindAt: null,
      pendingPrompt: null,
      archived: false,
      pendingCommissionClaim: null,
    },
    keeps: {
      id: 8,
      dealAmount: 300,
      paidAmount: 12,
      incomes: [
        {
          id: 1,
          amount: 120,
          at: '2026-03-14T10:00:00.000Z',
          paidAt: '2026-03-16T10:00:00.000Z',
        },
        {
          id: 2,
          amount: 180,
          at: '2026-03-14T10:00:00.000Z',
          paidAt: null,
        },
      ],
    },
  },
  {
    label:
      'v10: incomes written as incomes, one of them unsettled, and a claim naming it',
    record: {
      id: 9,
      brand: 'CarLab',
      name: 'Stefan',
      contact: '@stefan',
      service: 'parts-order',
      locale: 'sr',
      kind: 'lead',
      status: 'won',
      dealAmount: 500,
      commissionPercent: 10,
      paidAmount: 20,
      payments: [],
      incomes: [
        {
          id: 1,
          amount: 200,
          at: '2026-03-18T10:00:00.000Z',
          paidAt: '2026-03-19T10:00:00.000Z',
        },
        { id: 2, amount: 300, at: '2026-03-20T10:00:00.000Z' },
      ],
      telegramChatId: null,
      telegramMessageId: null,
      statusChangedAt: '2026-03-18T10:00:00.000Z',
      createdAt: '2026-03-05T10:00:00.000Z',
      remindAt: null,
      pendingPrompt: null,
      archived: false,
      pendingCommissionClaim: {
        amount: 30,
        claimedAt: '2026-03-20T11:00:00.000Z',
        incomeIds: [2],
      },
    },
    keeps: {
      id: 9,
      brand: 'CarLab',
      dealAmount: 500,
      paidAmount: 20,
      incomes: [
        {
          id: 1,
          amount: 200,
          at: '2026-03-18T10:00:00.000Z',
          paidAt: '2026-03-19T10:00:00.000Z',
        },
        { id: 2, amount: 300, at: '2026-03-20T10:00:00.000Z', paidAt: null },
      ],
      pendingCommissionClaim: {
        amount: 30,
        claimedAt: '2026-03-20T11:00:00.000Z',
        incomeIds: [2],
      },
    },
  },
  {
    label: 'v12: a postponed lead remembering the status it was postponed from',
    record: {
      id: 10,
      brand: 'Details',
      name: 'Jelena',
      contact: '+381603334455',
      service: 'ceramic-coating',
      locale: 'sr',
      kind: 'lead',
      status: 'postponed',
      dealAmount: null,
      commissionPercent: 10,
      paidAmount: 0,
      payments: [],
      incomes: [],
      telegramChatId: -1009876543210,
      telegramMessageId: 101,
      statusChangedAt: '2026-09-19T08:00:00.000Z',
      createdAt: '2026-09-18T08:00:00.000Z',
      remindAt: '2026-04-01',
      pendingPrompt: null,
      archived: false,
      pendingCommissionClaim: null,
      postponedFrom: 'negotiations',
    },
    keeps: {
      id: 10,
      brand: 'Details',
      status: 'postponed',
      remindAt: '2026-04-01',
      postponedFrom: 'negotiations',
      telegramChatId: -1009876543210,
    },
  },
  {
    label: 'a contact click rather than a form lead: no name, no service',
    record: {
      id: 11,
      brand: 'CarLab',
      name: '',
      contact: '+381604445566',
      service: '',
      contactChannel: 'whatsapp',
      locale: 'en',
      kind: 'call_click',
      status: 'new',
      source_url: 'https://carlab.rs/en/contacts/',
      visitorId: 'v-0011',
      dealAmount: null,
      commissionPercent: 10,
      paidAmount: 0,
      payments: [],
      incomes: [],
      telegramChatId: null,
      telegramMessageId: null,
      statusChangedAt: '2026-09-25T08:00:00.000Z',
      createdAt: '2026-09-25T08:00:00.000Z',
      remindAt: null,
      pendingPrompt: null,
      archived: false,
      pendingCommissionClaim: null,
      postponedFrom: null,
    },
    keeps: {
      id: 11,
      brand: 'CarLab',
      name: '',
      service: '',
      services: [],
      kind: 'call_click',
      contactChannel: 'whatsapp',
    },
  },
  {
    label:
      'a record carrying no rate of its own, the only shape whose read depends on which brand reads it',
    record: {
      id: 13,
      name: 'Vuk',
      contact: '@vuk',
      service: 'podbor-auto',
      locale: 'ru',
      statusChangedAt: '2026-03-09T10:00:00.000Z',
      createdAt: '2026-03-09T10:00:00.000Z',
    },
    keeps: {
      id: 13,
      brand: 'Approved.rs',
      commissionPercent: 10,
      status: 'new',
      services: [],
      incomes: [],
      payments: [],
      dealAmount: null,
      paidAmount: 0,
      archived: false,
      remindAt: null,
      postponedFrom: null,
      pendingPrompt: null,
      pendingCommissionClaim: null,
      telegramChatId: null,
      telegramMessageId: null,
    },
  },
];

const REFUSED: RefusedShape[] = [
  {
    label:
      'a commission rate worth more than the deal, writable before the cap landed',
    record: {
      id: 12,
      brand: 'Approved.rs',
      name: 'Marko',
      contact: '@marko',
      service: 'podbor-auto',
      locale: 'ru',
      kind: 'lead',
      status: 'won',
      dealAmount: 300,
      commissionPercent: 150,
      paidAmount: 0,
      payments: [],
      telegramChatId: null,
      telegramMessageId: null,
      statusChangedAt: '2026-03-17T10:00:00.000Z',
      createdAt: '2026-03-03T10:00:00.000Z',
      pendingPrompt: null,
      archived: false,
      pendingCommissionClaim: null,
    },
  },
];

const schemas = Object.entries(BRAND_COMMISSION_PERCENT).map(
  ([brand, defaultCommissionPercent]) =>
    [brand, createLeadSchema({ defaultCommissionPercent })] as const,
);

describe('every stored lead shape the system has written', () => {
  it('holds at least one record written by each brand', () => {
    const written = HISTORY.map(({ keeps }) => keeps.brand);

    for (const brand of Object.keys(BRAND_COMMISSION_PERCENT)) {
      expect(written).toContain(brand);
    }
  });

  it.each(HISTORY)('$label is still readable', ({ record, keeps }) => {
    const read = schemas.map(([brand, schema]) => {
      const parsed = schema.safeParse(record);
      expect(parsed.success, `${brand} refused the record`).toBe(true);
      return parsed.data;
    });

    for (const [index, lead] of read.entries()) {
      expect(lead, `${schemas[index][0]} read it differently`).toEqual(read[0]);
      expect(lead).toMatchObject(keeps);
    }
  });

  it.each(REFUSED)('$label is refused, not read differently', ({ record }) => {
    for (const [brand, schema] of schemas) {
      expect(schema.safeParse(record).success, `${brand} accepted it`).toBe(
        false,
      );
    }
  });
});
