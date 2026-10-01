import { WORKSHOP_ADDRESS } from '@podbor/brands';
import { withPlaceholder } from '@podbor/i18n/section';
import { MEDUSA_LOCALE, formatPrice } from '@podbor/shop-catalog';

import { buildOrderEmail, emailCopy, escapeHtml } from '../order-email';
import { RESERVE_DAYS } from '../shop';

const ORDER = {
  displayId: 7,
  locale: 'ru' as const,
  items: [
    { title: 'Bosch S4 024', quantity: 1, total: 11190 },
    { title: 'Установка аккумулятора', quantity: 1, total: 1500 },
  ],
  total: 12690,
};

describe('buildOrderEmail', () => {
  it('numbers the Russian subject and heading', () => {
    const email = buildOrderEmail(ORDER);

    expect(email.subject).toBe('Заказ №7 принят — CarLab');
    expect(email.text.split('\n')[0]).toBe('Заказ №7 принят');
  });

  it('lists every line and the total with prices in the customer language', () => {
    const { text } = buildOrderEmail(ORDER);

    expect(text).toContain(`Bosch S4 024 × 1 — ${formatPrice(11190, 'ru-RU')}`);
    expect(text).toContain(
      `Установка аккумулятора × 1 — ${formatPrice(1500, 'ru-RU')}`,
    );
    expect(text).toContain(`Итого: ${formatPrice(12690, 'ru-RU')}`);
  });

  it('tells the customer where to collect the order', () => {
    expect(buildOrderEmail(ORDER).text).toContain(
      `${WORKSHOP_ADDRESS.street}, ${WORKSHOP_ADDRESS.city}`,
    );
  });

  it('tells the customer how long the parts are held', () => {
    const { text, html } = buildOrderEmail(ORDER);
    const hold = emailCopy('ru').orderPlaced.holdNote;

    expect(text).toContain(hold);
    expect(html).toContain(hold);
  });

  it('escapes a product title before it reaches the HTML', () => {
    const { html } = buildOrderEmail({
      ...ORDER,
      items: [{ title: '<script>alert(1)</script>', quantity: 1, total: 1 }],
    });

    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
  });

  it.each(['sr', 'en'] as const)(
    'writes %s with the copy the loader serves for it',
    (locale) => {
      const email = buildOrderEmail({ ...ORDER, locale });

      expect(email.subject).toBe(
        withPlaceholder(
          emailCopy(locale).orderPlaced.subject,
          'displayId',
          '7',
        ),
      );
      expect(email.text).toContain(formatPrice(11190, MEDUSA_LOCALE[locale]));
      expect(email.html).toContain(`<html lang="${locale}">`);
    },
  );
});

describe('the email copy', () => {
  it('keeps the order number placeholder in the Russian source, so translations must keep it', () => {
    const copy = emailCopy('ru').orderPlaced;

    expect(copy.subject).toContain('{displayId}');
    expect(copy.heading).toContain('{displayId}');
  });

  it('names the reserve window the job enforces — the Russian spells the number out, plural and all', () => {
    expect(emailCopy('ru').orderPlaced.holdNote).toContain(
      `${RESERVE_DAYS} дня`,
    );
  });

  it.each(['sr', 'en'] as const)(
    'names the same window in %s, which spells it out too',
    (locale) => {
      expect(emailCopy(locale).orderPlaced.holdNote).toContain(
        String(RESERVE_DAYS),
      );
    },
  );
});

describe('escapeHtml', () => {
  it('escapes the characters that break markup or attributes', () => {
    expect(escapeHtml(`&<>"`)).toBe('&amp;&lt;&gt;&quot;');
  });
});
