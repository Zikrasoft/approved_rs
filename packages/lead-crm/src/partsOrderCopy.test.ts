import { describe, expect, it } from 'vitest';

import { dayWord, PARTS_ORDER_COPY } from './partsOrderCopy.ts';

describe('dayWord', () => {
  it.each([
    [1, 'день'],
    [2, 'дня'],
    [5, 'дней'],
    [21, 'день'],
    [1.5, 'дня'],
  ])('agrees %s with its noun', (days, word) => {
    expect(dayWord(days)).toBe(word);
  });
});

describe('PARTS_ORDER_COPY', () => {
  it('writes the order card lines the owner reads', () => {
    expect(PARTS_ORDER_COPY.heading(12)).toBe(
      'Заказ #12, самовывоз, оплата при получении',
    );
    expect(PARTS_ORDER_COPY.line('Oil', 2, '200 RSD')).toBe('Oil × 2: 200 RSD');
    expect(PARTS_ORDER_COPY.pickupIn(5)).toBe('забрать через 5 дней');
    expect(PARTS_ORDER_COPY.pickupIn(1)).toBe('забрать завтра');
    expect(PARTS_ORDER_COPY.addon('Mounting', '50 RSD')).toBe(
      '+ Mounting: 50 RSD',
    );
    expect(PARTS_ORDER_COPY.total('250 RSD')).toBe('Итого: 250 RSD');
    expect(
      PARTS_ORDER_COPY.leftOut(3, 'https://admin.carlab.rs/app/orders/o1'),
    ).toBe(
      'Не поместилось позиций: 3, весь заказ: https://admin.carlab.rs/app/orders/o1',
    );
  });

  it('names installation at CarLab and says when it is free', () => {
    expect(PARTS_ORDER_COPY.installation).toBe('Установка в сервисе CarLab');
    expect(PARTS_ORDER_COPY.free).toBe('бесплатно');
  });

  it('names the order that never reached the CRM and why', () => {
    expect(PARTS_ORDER_COPY.undelivered(12, 'timeout')).toMatch(
      /^Заказ #12 не дошел до CRM.*Причина: timeout$/,
    );
  });

  it('names the canceled order whose Lead the CRM never marked, and why', () => {
    expect(PARTS_ORDER_COPY.cancelUndelivered(12, 'timeout')).toMatch(
      /^Заказ #12 отменен в магазине.*Причина: timeout$/,
    );
  });

  it('says why a checkout did not become an order', () => {
    expect(
      PARTS_ORDER_COPY.notPlaced(PARTS_ORDER_COPY.notPlacedReason.unreachable),
    ).toBe('Заказ не оформлен: магазин не ответил. Свяжитесь с клиентом');
  });
});
