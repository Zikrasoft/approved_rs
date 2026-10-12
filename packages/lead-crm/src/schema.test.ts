import { describe, it, expect } from 'vitest';
import { storedLeadSchema, LEGACY_BRAND } from './schema.ts';

const base = {
  id: 1,
  name: 'Иван',
  contact: '@ivan',
  service: 'detailing',
  locale: 'ru',
  statusChangedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const schema = storedLeadSchema;

describe('services on a lead', () => {
  it('reads a record written before multi-select as having no extra services', () => {
    const lead = schema.parse(base);
    expect(lead.service).toBe('detailing');
    expect(lead.services).toEqual([]);
  });

  it('keeps every service a multi-select form sent', () => {
    const lead = schema.parse({
      ...base,
      service: 'polishing',
      services: ['polishing', 'ceramic-coating', 'ppf'],
    });
    expect(lead.services).toEqual(['polishing', 'ceramic-coating', 'ppf']);
  });
});

describe('brand on a store shared by several businesses', () => {
  it('reads a record written before the brand field existed as the original business', () => {
    expect(schema.parse(base).brand).toBe(LEGACY_BRAND);
  });

  it('keeps the brand already stored on the lead, so one store can hold several businesses', () => {
    expect(schema.parse({ ...base, brand: 'PRIZMA' }).brand).toBe('PRIZMA');
  });

  it('does not restamp another brand lead with the reading business own brand', () => {
    const stored = schema.parse({ ...base, brand: 'PRIZMA' });
    expect(schema.parse(stored).brand).toBe('PRIZMA');
  });
});

describe('records other businesses wrote', () => {
  it('keeps a locale this business does not serve, so a shared store is not truncated', () => {
    expect(schema.parse({ ...base, locale: 'de' }).locale).toBe('de');
  });

  it('keeps a comment longer than any form would accept, so old records survive a read', () => {
    const comment = 'x'.repeat(9000);

    expect(schema.parse({ ...base, comment }).comment).toBe(comment);
  });
});

describe('capturePrompt on a lead', () => {
  it('reads a record written before the capture dialog as having no prompt', () => {
    expect(schema.parse(base).capturePrompt).toBeNull();
  });

  it('keeps a step the capture bot is waiting on', () => {
    const lead = schema.parse({
      ...base,
      capturePrompt: { chatId: 42, step: 'budget' },
    });

    expect(lead.capturePrompt).toEqual({ chatId: 42, step: 'budget' });
  });

  it('drops a malformed capture prompt instead of making the whole lead unreadable', () => {
    const lead = schema.parse({
      ...base,
      capturePrompt: { chatId: 42, step: 'colour_preference' },
    });

    expect(lead.capturePrompt).toBeNull();
    expect(lead.contact).toBe('@ivan');
  });

  it('leaves the owner prompt alone', () => {
    const lead = schema.parse({
      ...base,
      pendingPrompt: { chatId: 1, messageId: 2, kind: 'postpone' },
      capturePrompt: { chatId: 42, step: 'phone' },
    });

    expect(lead.pendingPrompt).toEqual({
      chatId: 1,
      messageId: 2,
      kind: 'postpone',
    });
    expect(lead.capturePrompt).toEqual({ chatId: 42, step: 'phone' });
  });
});

it('drops a retired amount prompt from a lead', () => {
  const lead = schema.parse({
    ...base,
    pendingPrompt: { chatId: 1, messageId: 2, kind: 'deal_amount' },
  });

  expect(lead.pendingPrompt).toBeNull();
});

describe('referredBy on a lead', () => {
  it('reads a record written before referrals as not referred', () => {
    expect(schema.parse(base).referredBy).toBeNull();
  });

  it('keeps an Approved referral', () => {
    expect(schema.parse({ ...base, referredBy: 'approved' }).referredBy).toBe(
      'approved',
    );
  });

  it('drops an unknown referrer instead of quarantining the lead', () => {
    const lead = schema.parse({ ...base, referredBy: 'someone' });

    expect(lead.referredBy).toBeNull();
    expect(lead.contact).toBe('@ivan');
  });
});

describe('adTag on a lead', () => {
  it('reads a record written before ad tags as untagged', () => {
    expect(schema.parse(base).adTag).toBeNull();
  });

  it('keeps a well-formed tag', () => {
    expect(schema.parse({ ...base, adTag: 'ig-x1' }).adTag).toBe('ig-x1');
  });

  it.each(['yt-spring1', 'fb-', 'fb-spring.1', `fb-${'a'.repeat(17)}`])(
    'drops a malformed tag instead of quarantining the lead: %s',
    (adTag) => {
      expect(schema.parse({ ...base, adTag }).adTag).toBeNull();
    },
  );
});

describe('pendingPrompt on a lead', () => {
  it('accepts the postpone prompt', () => {
    const lead = schema.parse({
      ...base,
      pendingPrompt: { chatId: 1, messageId: 2, kind: 'postpone' },
    });

    expect(lead.pendingPrompt?.kind).toBe('postpone');
  });

  it.each(['add_income', 'reply_visitor'])(
    'drops a prompt for the retired %s action',
    (kind) => {
      const lead = schema.parse({
        ...base,
        pendingPrompt: { chatId: 1, messageId: 2, kind },
      });

      expect(lead.pendingPrompt).toBeNull();
      expect(lead.contact).toBe('@ivan');
    },
  );
});
