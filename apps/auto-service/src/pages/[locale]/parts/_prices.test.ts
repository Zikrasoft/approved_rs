import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CARLAB } from '@podbor/brands';
import { BCP47_BY_LOCALE } from '@/i18n/config';
import { formatMoney } from '@/utils/money';
import { parseHtml, respond, setShop } from '@/components/renderAstro';
import Prices from './prices.astro';

const backend = vi.fn();

beforeEach(() => {
  vi.stubEnv('MEDUSA_BACKEND_URL', 'http://shop.test');
  vi.stubEnv('MEDUSA_PUBLISHABLE_KEY', 'pk_test');
  vi.stubGlobal('fetch', backend);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  backend.mockReset();
});

const url = (locale = 'ru') => new URL(`/${locale}/parts/prices/`, CARLAB.url);

const post = (body: unknown) =>
  respond(
    Prices,
    new Request(url(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );

const tagSlot = { slots: [{ kind: 'tag', ids: 'pi_1' }] };

describe('/parts/prices', () => {
  it.each(['ru', 'sr'])(
    'sends a visitor who opens it in %s to the parts hub',
    async (locale) => {
      const response = await respond(Prices, new Request(url(locale)));

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe(`/${locale}/parts/`);
      expect(backend).not.toHaveBeenCalled();
    },
  );

  it('refuses a body that is not a slot list', async () => {
    setShop(true);

    expect((await post({ slots: [] })).status).toBe(400);
    expect((await post('{not json')).status).toBe(400);
    expect(backend).not.toHaveBeenCalled();
  });

  it('answers nothing and asks the shop for nothing while it is closed', async () => {
    setShop(false);
    const response = await post(tagSlot);

    expect(response.status).toBe(204);
    expect(backend).not.toHaveBeenCalled();
  });

  it('fills a price tag slot from the shop once it is open', async () => {
    setShop(true);
    backend.mockResolvedValue(
      Response.json({
        offers: {
          pi_1: [
            {
              id: 'offer_1',
              price: 1850,
              currency: 'RSD',
              stock_quantity: 2,
              lead_time_days: 0,
            },
          ],
        },
      }),
    );
    const response = await post(tagSlot);
    const slot = parseHtml(
      await response.text(),
    ).querySelector<HTMLTemplateElement>('template[data-slot="0"]')!;

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(slot.content.textContent).toContain(
      formatMoney(1850, 'RSD', BCP47_BY_LOCALE.ru),
    );
  });

  it('says the shop is unavailable when it fails to answer', async () => {
    setShop(true);
    backend.mockRejectedValue(new Error('down'));

    expect((await post(tagSlot)).status).toBe(503);
  });
});
