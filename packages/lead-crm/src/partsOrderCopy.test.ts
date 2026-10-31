import { describe, expect, it } from 'vitest';

import {
  dayWord,
  orderLineText,
  orderMoney,
  PARTS_ORDER_COPY,
} from './partsOrderCopy.ts';

describe('orderLineText', () => {
  const line = { title: 'Аккумулятор (VARTA 580901080)', quantity: 2 };

  it('prices a part line and says when it can be picked up and from whom', () => {
    expect(
      orderLineText(
        {
          ...line,
          unitPrice: 1850,
          addon: false,
          inStock: false,
          leadTimeDays: 3,
          source: 'Intercars',
        },
        'rsd',
      ),
    ).toBe(
      'Аккумулятор (VARTA 580901080) × 2: 3 700 RSD, забрать через 3 дня, Intercars',
    );
    expect(
      orderLineText({ ...line, unitPrice: 1850, addon: false }, 'RSD'),
    ).toBe('Аккумулятор (VARTA 580901080) × 2: 3 700 RSD');
    expect(
      orderLineText(
        { ...line, unitPrice: 1850, addon: false, inStock: true },
        'RSD',
      ),
    ).toBe('Аккумулятор (VARTA 580901080) × 2: 3 700 RSD, в наличии');
  });

  it('prices an add-on for every unit, or calls it free', () => {
    expect(
      orderLineText(
        { title: 'Регистрация', quantity: 2, unitPrice: 700, addon: true },
        'RSD',
      ),
    ).toBe('+ Регистрация: 1 400 RSD');
    expect(
      orderLineText(
        { title: 'Установка', quantity: 2, unitPrice: 0, addon: true },
        'RSD',
      ),
    ).toBe('+ Установка: бесплатно');
  });

  it('writes money the same way everywhere', () => {
    expect(orderMoney(75220, 'rsd')).toBe('75 220 RSD');
  });
});

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

  it('counts the cart lines a failed checkout could not fit', () => {
    expect(PARTS_ORDER_COPY.notPlacedLeftOut(3)).toBe(
      'Не поместилось позиций: 3',
    );
  });
});
