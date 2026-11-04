import { describe, expect, it } from 'vitest';
import { specsCard } from './menu.ts';

describe('a service card built from a service page', () => {
  it('shows the short line, price, duration and what is included', () => {
    expect(
      specsCard(
        { specsPriceLabel: 'Цена', specsDurationLabel: 'Срок' },
        {
          name: 'Плановое ТО',
          short: 'Масло и фильтры.',
          priceFrom: 'от 90 €',
          duration: '2–4 часа',
          includesHeading: 'Что входит',
          includes: ['Масло', 'Фильтры'],
        },
        'https://carlab.rs/ru/services/servicing/',
      ),
    ).toEqual({
      title: 'Плановое ТО',
      lines: [
        'Масло и фильтры.',
        '',
        'Цена: от 90 €',
        'Срок: 2–4 часа',
        '',
        'Что входит:',
        '• Масло',
        '• Фильтры',
      ],
      url: 'https://carlab.rs/ru/services/servicing/',
    });
  });

  const service = {
    name: 'Плановое ТО',
    short: 'Масло и фильтры.',
    duration: '2–4 часа',
    includesHeading: 'Что входит',
    includes: ['Масло'],
  };
  const url = 'https://carlab.rs/ru/services/servicing/';
  const withoutPrice = [
    'Масло и фильтры.',
    '',
    'Срок: 2–4 часа',
    '',
    'Что входит:',
    '• Масло',
  ];

  it('leaves the price out when the brand gives no price label', () => {
    expect(
      specsCard(
        { specsDurationLabel: 'Срок' },
        { ...service, priceFrom: 'от 90 €' },
        url,
      ).lines,
    ).toEqual(withoutPrice);
  });

  it('leaves the price out when the service has none', () => {
    expect(
      specsCard(
        { specsPriceLabel: 'Цена', specsDurationLabel: 'Срок' },
        service,
        url,
      ).lines,
    ).toEqual(withoutPrice);
  });
});
