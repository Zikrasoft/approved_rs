import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLeadsRoute } from './leads.ts';

type Locale = 'ru' | 'en' | 'sr';

const LOCALES: readonly string[] = ['ru', 'en', 'sr'];

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
    ru: 'Имя и контакт обязательны',
    en: 'Name and contact are required',
    sr: 'Ime i kontakt su obavezni',
  },
});

function makeCtx(fields: Record<string, string>, cookieLocale?: string) {
  const formData = new FormData();
  Object.entries(fields).forEach(([k, v]) => formData.append(k, v));
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

describe('createLeadsRoute', () => {
  beforeEach(() => {
    notifyLead.mockReset().mockResolvedValue(undefined);
    waitUntil.mockReset();
  });

  it('redirects to the default locale thanks page on valid data', async () => {
    const ctx = makeCtx({
      name: 'Иван',
      contact: '@ivan',
      service: 'vehicle-sourcing',
    });
    await POST(ctx);
    expect(ctx.redirect).toHaveBeenCalledWith('/ru/thanks/', 302);
  });

  it('redirects to the locale from the cookie', async () => {
    const ctx = makeCtx({ name: 'Ivan', contact: '@ivan' }, 'sr');
    await POST(ctx);
    expect(ctx.redirect).toHaveBeenCalledWith('/sr/thanks/', 302);
  });

  it('falls back to the default locale for a cookie outside the locale set', async () => {
    const ctx = makeCtx({ name: 'Ivan', contact: '@ivan' }, 'zh');
    await POST(ctx);
    expect(ctx.redirect).toHaveBeenCalledWith('/ru/thanks/', 302);
  });

  it('prefers the locale the form carries over the cookie', async () => {
    const ctx = makeCtx({ name: 'Ivan', contact: '@ivan', locale: 'en' }, 'ru');
    await POST(ctx);
    expect(ctx.redirect).toHaveBeenCalledWith('/en/thanks/', 302);
    expect(notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({ locale: 'en' }),
      '[leads]',
    );
  });

  it('ignores a form locale outside the locale set', async () => {
    const ctx = makeCtx({ name: 'Ivan', contact: '@ivan', locale: 'zh' }, 'sr');
    await POST(ctx);
    expect(ctx.redirect).toHaveBeenCalledWith('/ru/thanks/', 302);
  });

  it('truncates an oversized field instead of storing it whole', async () => {
    await POST(
      makeCtx({
        name: 'a'.repeat(5000),
        contact: 'b'.repeat(5000),
        comment: 'c'.repeat(9000),
        source_url: `/ru/${'d'.repeat(9000)}`,
        visitor_id: 'e'.repeat(5000),
      }),
    );
    const lead = notifyLead.mock.calls.at(-1)![0];
    expect(lead.name).toHaveLength(200);
    expect(lead.contact).toHaveLength(200);
    expect(lead.comment).toHaveLength(2000);
    expect(lead.source_url).toHaveLength(500);
    expect(lead.visitorId).toHaveLength(200);
  });

  it('returns 400 when name is empty', async () => {
    const res = await POST(makeCtx({ name: '', contact: '@ivan' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when contact is missing', async () => {
    const res = await POST(makeCtx({ name: 'Иван' }));
    expect(res.status).toBe(400);
  });

  it('answers the 400 in the visitor own locale', async () => {
    const res = await POST(makeCtx({ name: '' }, 'sr'));
    await expect(res.text()).resolves.toBe('Ime i kontakt su obavezni');
  });

  it('answers the 400 in the default locale for a prototype-key cookie value', async () => {
    const res = await POST(makeCtx({ name: '' }, 'constructor'));
    await expect(res.text()).resolves.toBe('Имя и контакт обязательны');
  });

  it('dispatches notifyLead via waitUntil with the parsed form fields', async () => {
    await POST(
      makeCtx({
        name: 'Иван',
        contact: '@ivan',
        service: 'vehicle-buyback',
        contact_channel: 'telegram',
        comment: 'BMW X5',
        country: 'de',
        source_url: '/ru/vehicle-buyback/de/',
        visitor_id: 'abc-123',
      }),
    );
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(notifyLead).toHaveBeenCalledWith(
      {
        name: 'Иван',
        contact: '@ivan',
        service: 'vehicle-buyback',
        contactChannel: 'telegram',
        comment: 'BMW X5',
        country: 'de',
        source_url: '/ru/vehicle-buyback/de/',
        visitorId: 'abc-123',
        locale: 'ru',
      },
      '[leads]',
    );
  });

  it('sends null rather than an empty string for the optional fields', async () => {
    await POST(makeCtx({ name: 'Иван', contact: '@ivan' }));
    expect(notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({
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
    const ctx = makeCtx({ name: 'Иван', contact: '@ivan' });

    await POST(ctx);

    expect(ctx.redirect).toHaveBeenCalledWith('/ru/thanks/', 302);
    resolveNotify();
  });
});
