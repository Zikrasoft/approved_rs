// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PREVIEW_FLAG_COOKIE } from '@/utils/shopPreview';
import { definePriceSlots } from './priceSlots';
import { PRICES_FILLED_EVENT } from './shopPreview';

definePriceSlots();

const slot = (fields: string, fresh = true) =>
  `<price-slot data-kind="tag" ${fresh ? 'data-fresh' : ''} data-src="/ru/parts/prices/" data-fields='${fields}'><span>stale</span></price-slot>`;

const answer = (status: number, body: string) =>
  vi.fn(
    async (_url: string, _init?: RequestInit) => new Response(body, { status }),
  );

const settle = () => new Promise((resolve) => setTimeout(resolve));

const slotText = () =>
  [...document.querySelectorAll('price-slot')].map((s) => s.textContent);

const filled = vi.fn();
document.addEventListener(PRICES_FILLED_EVENT, filled);

afterEach(() => {
  vi.unstubAllGlobals();
  filled.mockClear();
  document.cookie = `${PREVIEW_FLAG_COOKIE}=; max-age=0`;
});

describe('<price-slot>', () => {
  it('fills every slot on the page from one request', async () => {
    const fetch = answer(
      200,
      '<template data-slot="0"><b>100 RSD</b></template><template data-slot="1"><b>200 RSD</b></template>',
    );
    vi.stubGlobal('fetch', fetch);
    document.body.innerHTML = slot('{"ids":"a"}') + slot('{"ids":"b"}');
    await settle();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('/ru/parts/prices/');
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({
      slots: [
        { kind: 'tag', ids: 'a' },
        { kind: 'tag', ids: 'b' },
      ],
    });
    expect(slotText()).toEqual(['100 RSD', '200 RSD']);
    expect(filled).toHaveBeenCalledTimes(1);
  });

  it('keeps the built price when its template comes back empty', async () => {
    vi.stubGlobal('fetch', answer(200, '<template data-slot="0"></template>'));
    document.body.innerHTML = slot('{}');
    await settle();
    expect(slotText()).toEqual(['stale']);
  });

  it.each([
    ['the shop answers with an error', answer(503, '')],
    [
      'the request fails',
      vi.fn(async () => {
        throw new TypeError('offline');
      }),
    ],
  ])('keeps the page as built when %s', async (_, fetch) => {
    vi.stubGlobal('fetch', fetch);
    document.body.innerHTML = slot('{}');
    await settle();
    expect(slotText()).toEqual(['stale']);
    expect(filled).not.toHaveBeenCalled();
  });

  it('asks nothing for a built price outside the shop preview', async () => {
    const fetch = answer(200, '');
    vi.stubGlobal('fetch', fetch);
    document.body.innerHTML = slot('{}', false);
    await settle();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refreshes a built price in the shop preview, once per slot', async () => {
    const fetch = answer(200, '');
    vi.stubGlobal('fetch', fetch);
    document.cookie = `${PREVIEW_FLAG_COOKIE}=1`;
    document.body.innerHTML = slot('{}', false);
    const built = document.querySelector('price-slot')!;
    built.remove();
    document.body.append(built);
    await settle();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
