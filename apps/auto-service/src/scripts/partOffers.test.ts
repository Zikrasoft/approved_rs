// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { definePartOffers } from './partOffers';
import { readPartsList } from './partsList';

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
  localStorage.clear();
});

describe('<part-offers> when the shop refuses the add', () => {
  it('swaps the dead buy button for the inquiry and keeps the part in it', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ kind: 'refused', code: 'OFFER_MISSING' }),
        ),
    );
    definePartOffers();
    document.body.innerHTML = `
      <part-offers data-preview data-slug="knecht-ox371d" data-brand="Knecht"
        data-number="OX 371D" data-name="Масляный фильтр">
        <ul data-offers><li>
          <button data-buy data-offer-id="offer_1">В корзину</button>
          <a href="/ru/parts/#parts-inquiry" class="hidden" data-ask>Заказать через менеджера</a>
        </li></ul>
        <p data-status="inquiry" hidden></p>
      </part-offers>`;

    document.querySelector<HTMLButtonElement>('[data-buy]')!.click();
    await vi.waitFor(() =>
      expect(
        document.querySelector<HTMLElement>('[data-status="inquiry"]')!.hidden,
      ).toBe(false),
    );

    expect(document.querySelector<HTMLElement>('[data-buy]')!.hidden).toBe(
      true,
    );
    expect(
      document.querySelector('[data-ask]')!.classList.contains('hidden'),
    ).toBe(false);
    expect(readPartsList().map((part) => part.number)).toEqual(['OX 371D']);
  });
});
