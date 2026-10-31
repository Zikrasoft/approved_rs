import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SERVICE_SLUGS_BY_BRAND } from '@podbor/brands';
import { MAX_SERVICES } from '../form.ts';
import { createLeadsRoute } from './leads.ts';
import {
  ORDER_CANCELED,
  ORDER_ID_FIELD,
  ORDER_OUTCOME_FIELD,
} from '../fields.ts';

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
  consent: 'on',
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

  it('answers a body that is not a form with the refusal page, not a crash', async () => {
    const ctx = {
      ...makeCtx({}),
      request: new Request('http://localhost/api/leads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"contact":"+381641234567"}',
      }),
    };

    const response = await POST(ctx);

    expect(response.status).toBe(400);
    expect(notifyLead).not.toHaveBeenCalled();
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

  it('stores a lead without an ad visit when the field is missing or forged', async () => {
    await POST(makeCtx(valid()));
    await POST(makeCtx(valid({ ad_source: '<script>' })));
    expect(notifyLead.mock.calls.map(([lead]) => lead.adSource)).toEqual([
      null,
      null,
    ]);
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

  it('folds a VIN/chassis number into the comment, labeled, ahead of it', async () => {
    await POST(
      makeCtx(
        valid({ vin: 'WBAVB13506JH12345', comment: 'Нужны тормозные колодки' }),
      ),
    );
    expect(notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({
        comment: 'VIN: WBAVB13506JH12345\nНужны тормозные колодки',
      }),
      '[leads]',
    );
  });

  it('passes the comment through as the owner reads it', async () => {
    await POST(makeCtx(valid({ comment: 'BMW X5 2019, стучит спереди' })));
    expect(notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({ comment: 'BMW X5 2019, стучит спереди' }),
      '[leads]',
    );
  });

  it('takes a lead whose name is empty, because only the contact is required', async () => {
    const res = await POST(
      makeCtx({ name: '', contact: RS_PHONE, consent: 'on' }),
    );
    expect(res.status).toBe(302);
    expect(notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({ name: '' }),
      '[leads]',
    );
  });

  it('takes a lead from a form that has no name field at all', async () => {
    const res = await POST(makeCtx({ contact: RS_PHONE, consent: 'on' }));
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

  it('refuses a submission whose consent box never reached the server', async () => {
    const res = await POST(makeCtx({ name: 'Иван', contact: RS_PHONE }));
    expect(res.status).toBe(400);
    expect(notifyLead).not.toHaveBeenCalled();
  });

  it('returns 400 without leaking the schema when the contact is not a phone', async () => {
    const res = await POST(
      makeCtx({ name: 'Иван', contact: 'asdf', consent: 'on' }),
    );
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    const body = await res.text();
    expect(body).toContain('<p>Укажите контакт</p>');
    expect(body).not.toMatch(/zod|invalid_type|path/i);
  });

  it('returns 400 for a contact_channel outside the tracked set', async () => {
    const res = await POST(makeCtx(valid({ contact_channel: 'sms' })));
    expect(res.status).toBe(400);
    expect(notifyLead).not.toHaveBeenCalled();
  });

  it('answers the 400 in the visitor own locale, in a page a browser can render', async () => {
    const res = await POST(makeCtx({ name: '' }, 'sr'));
    const body = await res.text();
    expect(body).toContain('<html lang="sr">');
    expect(body).toContain('<p>Unesite kontakt</p>');
    expect(body).toContain('name="viewport"');
  });

  it('answers the 400 in the default locale for a prototype-key cookie value', async () => {
    const res = await POST(makeCtx({ name: '' }, 'constructor'));
    await expect(res.text()).resolves.toContain('<p>Укажите контакт</p>');
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
        ad_source: JSON.stringify({
          source: 'facebook',
          campaign: 'spring_buyback',
          at: '2026-10-01T10:00:00.000Z',
        }),
        meta_ids: JSON.stringify({
          fbc: 'fb.1.1760000000000.IwAR2F4-dbP0l7Mn',
          fbp: 'fb.1.1596403881668.1116446470',
        }),
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
        adSource: {
          source: 'facebook',
          campaign: 'spring_buyback',
          at: '2026-10-01T10:00:00.000Z',
        },
        metaIds: {
          fbc: 'fb.1.1760000000000.IwAR2F4-dbP0l7Mn',
          fbp: 'fb.1.1596403881668.1116446470',
        },
        orderId: null,
        locale: 'ru',
      },
      '[leads]',
    );
  });

  it('stores every selected service, with the first one as the primary', async () => {
    await POST(
      makeCtx(
        valid({ service: ['polishing-ceramic', 'paint-protection-film'] }),
      ),
    );
    expect(notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'polishing-ceramic',
        services: ['polishing-ceramic', 'paint-protection-film'],
      }),
      '[leads]',
    );
  });

  it('keeps the visible contact when the script never ran to unname the fallback field', async () => {
    const ctx = makeCtx({
      name: 'Иван',
      contact: ['@ivan', ''],
      contact_channel: 'telegram',
      consent: 'on',
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
          service: Array.from({ length: 10_000 }, () => 'vehicle-sourcing'),
        }),
      ),
    );
    const lead = notifyLead.mock.calls.at(-1)![0];
    expect(lead.services).toHaveLength(MAX_SERVICES);
    expect(lead.service).toBe('vehicle-sourcing');
  });

  it.each(Object.entries(SERVICE_SLUGS_BY_BRAND))(
    'accepts every %s slug and keeps the contact of one outside the enum, without its service',
    async (brand, slugs) => {
      for (const slug of slugs) {
        const ctx = makeCtx(valid({ service: slug }));
        await POST(ctx);
        expect(ctx.redirect).toHaveBeenCalledWith('/ru/thanks/', 302);
      }
      const ctx = makeCtx(valid({ service: [`${brand}-no-such`, slugs[0]] }));
      await POST(ctx);
      expect(ctx.redirect).toHaveBeenCalledWith('/ru/thanks/', 302);
      expect(notifyLead).toHaveBeenLastCalledWith(
        expect.objectContaining({ service: slugs[0], services: [slugs[0]] }),
        '[leads]',
      );
    },
  );

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

describe('a shop Order cancelled in the shop admin', () => {
  const cancelOrder = vi.fn();
  const cancelPOST = createLeadsRoute<Locale>({
    notifyLead,
    waitUntil,
    isLocale: (value): value is Locale => LOCALES.includes(value),
    defaultLocale: 'ru',
    localeCookie: 'lang',
    thanksPath: (locale) => `/${locale}/thanks/`,
    missingFieldsMessage: { ru: 'ru', en: 'en', sr: 'sr' },
    orderCanceled: { secret: 'shop-secret', cancel: cancelOrder },
  });

  const cancelCtx = (authorization?: string) => {
    const ctx = makeCtx({
      [ORDER_ID_FIELD]: 'order_01',
      [ORDER_OUTCOME_FIELD]: ORDER_CANCELED,
    });
    if (authorization) ctx.request.headers.set('authorization', authorization);
    return ctx;
  };

  beforeEach(() => {
    cancelOrder.mockReset().mockResolvedValue('lost');
    notifyLead.mockReset();
  });

  it('marks the Lead lost when the shop proves who it is', async () => {
    const response = await cancelPOST(cancelCtx('Bearer shop-secret'));

    expect(response.status).toBe(204);
    expect(cancelOrder).toHaveBeenCalledWith('order_01');
    expect(notifyLead).not.toHaveBeenCalled();
  });

  it('answers 404 while no Lead carries the Order, so the shop retries', async () => {
    cancelOrder.mockResolvedValue('missing');

    const response = await cancelPOST(cancelCtx('Bearer shop-secret'));

    expect(response.status).toBe(404);
  });

  it('answers 409 for a won Lead, so the shop never takes it for lost', async () => {
    cancelOrder.mockResolvedValue('won');

    const response = await cancelPOST(cancelCtx('Bearer shop-secret'));

    expect(response.status).toBe(409);
  });

  it.each([undefined, 'Bearer wrong', 'shop-secret'])(
    'refuses a cancel without the shop secret (%s)',
    async (authorization) => {
      const response = await cancelPOST(cancelCtx(authorization));

      expect(response.status).toBe(401);
      expect(cancelOrder).not.toHaveBeenCalled();
    },
  );

  const orderLeadCtx = (authorization?: string) => {
    const ctx = makeCtx(valid({ [ORDER_ID_FIELD]: 'order_01' }));
    if (authorization) ctx.request.headers.set('authorization', authorization);
    return ctx;
  };

  it('stores the Lead of a placed Order the shop proves it sent', async () => {
    const ctx = orderLeadCtx('Bearer shop-secret');

    await cancelPOST(ctx);

    expect(ctx.redirect).toHaveBeenCalledWith('/ru/thanks/', 302);
    expect(notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order_01' }),
      '[leads]',
    );
  });

  it.each([undefined, 'Bearer wrong'])(
    'refuses a Lead naming an Order without the shop secret (%s)',
    async (authorization) => {
      const response = await cancelPOST(orderLeadCtx(authorization));

      expect(response.status).toBe(401);
      expect(notifyLead).not.toHaveBeenCalled();
    },
  );

  it('refuses a Lead naming an Order on a site that takes none', async () => {
    const response = await POST(orderLeadCtx('Bearer shop-secret'));

    expect(response.status).toBe(401);
    expect(notifyLead).not.toHaveBeenCalled();
  });

  it('refuses a cancel on a site that takes none', async () => {
    const response = await POST(cancelCtx('Bearer shop-secret'));

    expect(response.status).toBe(401);
  });
});
