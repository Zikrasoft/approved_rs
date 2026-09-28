import { parseAttributes } from '@podbor/shop-catalog';

import { BATTERIES } from '../battery-fixture';

describe('the battery fixture', () => {
  it('carries the eight batteries of the old shop', () => {
    expect(BATTERIES.map((battery) => battery.handle)).toEqual([
      'bosch-s4-024',
      'bosch-s5-008',
      'exide-agm-ek950',
      'exide-premium-ea770',
      'moll-kamina-start-72',
      'topla-energy-60',
      'varta-agm-e39',
      'varta-blue-dynamic-e12',
    ]);
  });

  it('fits the battery type in the registry', () => {
    for (const battery of BATTERIES) {
      expect(
        parseAttributes('batteries', {
          spec: battery.spec,
          fitment: battery.fitment,
        }),
      ).toMatchObject({ ok: true });
    }
  });

  it('keeps the translations the old shop already had', () => {
    const bosch = BATTERIES.find(
      (battery) => battery.handle === 'bosch-s4-024',
    );

    expect(bosch?.translations.sr.description).toMatch(
      /^\*\*Obrnuta polaritet\*\*/,
    );
    expect(bosch?.translations.en.description).toMatch(
      /^\*\*Reverse polarity\*\*/,
    );
  });

  it('stocks nothing the old shop marked out of stock', () => {
    expect(
      BATTERIES.find((battery) => battery.handle === 'exide-agm-ek950')?.stock,
    ).toBe(0);
  });
});
