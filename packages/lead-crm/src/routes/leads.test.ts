import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MAX_SERVICES } from '../form.ts';
import { createLeadsRoute } from './leads.ts';

type Locale = 'ru' | 'en' | 'sr';

const LOCALES: readonly string[] = ['ru', 'en', 'sr'];

const RS_PHONE = '+381641234567';

const notifyLead = vi.fn().mockResolvedValue(undefined);
const waitUntil = vi.fn();

const POST = createLeadsRoute<Locale>({
  notifyLead,
  waitUntil,
  isLocale: (value): value is Locale => LOCALES.includes(value),
  defaultLocale: 'ru',
  localeCookie: 'lang',
  thanksPath: (locale) => `/${locale}/thanks/`,
  missingFieldsMessage: {
    ru: 'Укажите контакт',
    en: 'Please enter a contact',
    sr: 'Unesite kontakt',
  },
});

type Field = string | File;

function makeCtx(
  fields: Record<string, Field | Field[]>,
  cookieLocale?: string,
) {
  const formData = new FormData();
  Object.entries(fields).forEach(([k, v]) => {
    if (Array.isArray(v)) v.forEach((item) => formData.append(k, item));
    else formData.append(k, v);
  });
  return {
    request: new Request('http://localhost/api/leads', {
      method: 'POST',
      body: formData,
    }),
    redirect: vi.fn(
      (url: string, status?: number) =>
        new Response(null, { status, headers: { Location: url } }),
    ),
    cookies: {
      get: () => (cookieLocale ? { value: cookieLocale } : undefined),
    },
  };
}

const valid = (extra: Record<string, Field | Field[]> = {}) => ({
  name: 'Иван',
  contact: RS_PHONE,
  ...extra,
});

describe('createLeadsRoute', () => {
  beforeEach(() => {
    notifyLead.mockReset().mockResolvedValue(undefined);
    waitUntil.mockReset();
  });

  it('redirects to the default locale thanks page on valid data', async () => {
    const ctx = makeCtx(valid({ service: 'vehicle-sourcing' }));
    await POST(ctx);
    expect(ctx.redirect).toHaveBeenCalledWith('/ru/thanks/', 302);
  });

  it('redirects to the locale from the cookie', async () => {
    const ctx = makeCtx(valid(), 'sr');
    await POST(ctx);
    expect(ctx.redirect).toHaveBeenCalledWith('/sr/thanks/', 302);
  });

  it('falls back to the default locale for a cookie outside the locale set', async () => {
    const ctx = makeCtx(valid(), 'zh');
    await POST(ctx);
    expect(ctx.redirect).toHaveBeenCalledWith('/ru/thanks/', 302);
  });

  it('prefers the locale the form carries over the cookie', async () => {
    const ctx = makeCtx(valid({ locale: 'en' }), 'ru');
    await POST(ctx);
    expect(ctx.redirect).toHaveBeenCalledWith('/en/thanks/', 302);
    expect(notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({ locale: 'en' }),
      '[leads]',
    );
  });

  it('ignores a form locale outside the locale set', async () => {
    const ctx = makeCtx(valid({ locale: 'zh' }), 'sr');
    await POST(ctx);
    expect(ctx.redirect).toHaveBeenCalledWith('/ru/thanks/', 302);
  });

  it('truncates an oversized field instead of storing it whole', async () => {
    await POST(
      makeCtx(
        valid({
          name: 'a'.repeat(5000),
          comment: 'c'.repeat(9000),
          source_url: `/ru/${'d'.repeat(9000)}`,
        }),
      ),
    );
    const lead = notifyLead.mock.calls.at(-1)![0];
    expect(lead.name).toHaveLength(200);
    expect(lead.comment).toHaveLength(2000);
    expect(lead.source_url).toHaveLength(500);
  });

  it('drops a visitor id that is not one this site could have issued', async () => {
    await POST(makeCtx(valid({ visitor_id: 'a'.repeat(5000) })));
    expect(notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({ visitorId: null }),
      '[leads]',
    );
  });

  it('silently thanks a bot that filled the hidden field, without storing anything', async () => {
    const ctx = makeCtx(valid({ website: 'http://spam.example' }));
    await POST(ctx);
    expect(ctx.redirect).toHaveBeenCalledWith('/ru/thanks/', 302);
    expect(notifyLead).not.toHaveBeenCalled();
  });

  it('treats a honeypot uploaded as a file as a hit, keeping the locale it carried', async () => {
    const ctx = makeCtx(
      valid({ locale: 'en', website: new File([], 'x.txt') }),
      'ru',
    );
    await POST(ctx);
    expect(ctx.redirect).toHaveBeenCalledWith('/en/thanks/', 302);
    expect(notifyLead).not.toHaveBeenCalled();
  });

  it('still stores the lead when the locale field is not text', async () => {
    const ctx = makeCtx(valid({ locale: new File([], 'x.txt') }), 'sr');
    await POST(ctx);
    expect(ctx.redirect).toHaveBeenCalledWith('/sr/thanks/', 302);
    expect(notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({ locale: 'sr' }),
      '[leads]',
    );
  });

  it('silently thanks a bot even when the rest of its submission is garbage', async () => {
    const ctx = makeCtx({ name: '', website: 'http://spam.example' });
    await POST(ctx);
    expect(ctx.redirect).toHaveBeenCalledWith('/ru/thanks/', 302);
    expect(notifyLead).not.toHaveBeenCalled();
  });

  it('still folds a car field posted by a page cached before the field was merged away', async () => {
    await POST(
      makeCtx(valid({ car: 'BMW X5 2019', comment: 'Стучит спереди' })),
    );
    expect(notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({ comment: 'BMW X5 2019\nСтучит спереди' }),
      '[leads]',
    );
  });

  it('passes the comment through as the operator reads it', async () => {
    await POST(makeCtx(valid({ comment: 'BMW X5 2019, стучит спереди' })));
    expect(notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({ comment: 'BMW X5 2019, стучит спереди' }),
      '[leads]',
    );
  });

  it('takes a lead whose name is empty, because only the contact is required', async () => {
    const res = await POST(makeCtx({ name: '', contact: RS_PHONE }));
    expect(res.status).toBe(302);
    expect(notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({ name: '' }),
      '[leads]',
    );
  });

  it('returns 400 when contact is missing', async () => {
    const res = await POST(makeCtx({ name: 'Иван' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 without leaking the schema when the contact is not a phone', async () => {
    const res = await POST(makeCtx({ name: 'Иван', contact: 'asdf' }));
    expect(res.status).toBe(400);
    await expect(res.text()).resolves.toBe('Укажите контакт');
  });

  it('returns 400 for a contact_channel outside the tracked set', async () => {
    const res = await POST(makeCtx(valid({ contact_channel: 'sms' })));
    expect(res.status).toBe(400);
    expect(notifyLead).not.toHaveBeenCalled();
  });

  it('answers the 400 in the visitor own locale', async () => {
    const res = await POST(makeCtx({ name: '' }, 'sr'));
    await expect(res.text()).resolves.toBe('Unesite kontakt');
  });

  it('answers the 400 in the default locale for a prototype-key cookie value', async () => {
    const res = await POST(makeCtx({ name: '' }, 'constructor'));
    await expect(res.text()).resolves.toBe('Укажите контакт');
  });

  it('dispatches notifyLead via waitUntil with the parsed form fields', async () => {
    await POST(
      makeCtx({
        name: 'Иван',
        contact: '@ivan',
        contact_channel: 'telegram',
        service: 'vehicle-buyback',
        comment: 'BMW X5',
        country: 'de',
        city: 'Belgrade',
        consent: 'on',
        source_url: '/ru/vehicle-buyback/de/',
        visitor_id: '9f1c2b7e-4a3d-4c9e-8b21-6f0d5a7c3e11',
      }),
    );
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(notifyLead).toHaveBeenCalledWith(
      {
        name: 'Иван',
        contact: '@ivan',
        service: 'vehicle-buyback',
        services: ['vehicle-buyback'],
        contactChannel: 'telegram',
        comment: 'BMW X5',
        country: 'de',
        source_url: '/ru/vehicle-buyback/de/',
        visitorId: '9f1c2b7e-4a3d-4c9e-8b21-6f0d5a7c3e11',
        locale: 'ru',
      },
      '[leads]',
    );
  });

  it('stores every selected service, with the first one as the primary', async () => {
    await POST(
      makeCtx(valid({ service: ['polishing', 'ceramic-coating', 'ppf'] })),
    );
    expect(notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'polishing',
        services: ['polishing', 'ceramic-coating', 'ppf'],
      }),
      '[leads]',
    );
  });

  it('keeps the visible contact when the script never ran to unname the fallback field', async () => {
    const ctx = makeCtx({
      name: 'Иван',
      contact: ['@ivan', ''],
      contact_channel: 'telegram',
    });
    await POST(ctx);
    expect(ctx.redirect).toHaveBeenCalledWith('/ru/thanks/', 302);
    expect(notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({ contact: '@ivan' }),
      '[leads]',
    );
  });

  it('caps a flooded service list instead of storing every value posted', async () => {
    await POST(
      makeCtx(
        valid({
          service: Array.from({ length: 10_000 }, (_, i) => `service-${i}`),
        }),
      ),
    );
    const lead = notifyLead.mock.calls.at(-1)![0];
    expect(lead.services).toHaveLength(MAX_SERVICES);
    expect(lead.service).toBe('service-0');
  });

  it('sends null rather than an empty string for the optional fields', async () => {
    await POST(makeCtx(valid({ service: '' })));
    expect(notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({
        service: '',
        services: [],
        contactChannel: null,
        comment: null,
        country: null,
        source_url: null,
        visitorId: null,
      }),
      '[leads]',
    );
  });

  it('redirects without waiting for notifyLead to resolve', async () => {
    let resolveNotify!: () => void;
    notifyLead.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveNotify = resolve;
      }),
    );
    const ctx = makeCtx(valid());

    await POST(ctx);

    expect(ctx.redirect).toHaveBeenCalledWith('/ru/thanks/', 302);
    resolveNotify();
  });
});
