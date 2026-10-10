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
});
