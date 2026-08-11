import { describe, it, expect } from 'vitest';
import type { CollectionEntry } from 'astro:content';
import { toCaseItem, toAutoserviceCaseItem } from './cases';

const price = { value: '5000', currency: 'EUR' };

describe('toCaseItem', () => {
  it('maps a known service to its Russian label', () => {
    const entry = {
      id: 'bmw-x1',
      data: { service: 'vehicle-sourcing', car: 'BMW X1', year: 2020, price, image: undefined },
    } as unknown as CollectionEntry<'cases'>;

    const item = toCaseItem(entry, 'ru');
    expect(item.href).toBe('/ru/cases/bmw-x1/');
    expect(item.badges).toEqual(['Автоподбор']);
  });

  it('falls back to the raw slug for an unknown service', () => {
    const entry = {
      id: 'mystery',
      data: { service: 'unknown-service', car: 'Skoda Superb', year: 2019, price, image: undefined },
    } as unknown as CollectionEntry<'cases'>;

    expect(toCaseItem(entry, 'ru').badges).toEqual(['unknown-service']);
  });
});

describe('toAutoserviceCaseItem', () => {
  it('maps each applied service to its own badge, falling back to the raw slug for unknown ones', () => {
    const entry = {
      id: 'bmw-320',
      data: {
        servicesApplied: ['diagnostics', 'engine', 'unknown-service'],
        car: 'BMW 320',
        year: 2018,
        image: undefined,
      },
    } as unknown as CollectionEntry<'autoserviceCases'>;

    const item = toAutoserviceCaseItem(entry, 'ru');
    expect(item.href).toBe('/ru/auto-service-belgrade/bmw-320/');
    expect(item.badges).toEqual(['Компьютерная диагностика', 'Двигатель и трансмиссия', 'unknown-service']);
  });
});
