import { describe, it, expect } from 'vitest';
import type { CollectionEntry } from 'astro:content';
import { toCaseItem, toAutoserviceCaseItem, toDetailingCaseItem, getCaseTranslation } from './cases';

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

describe('toDetailingCaseItem', () => {
  it('maps each applied service to its own badge, falling back to the raw slug for unknown ones', () => {
    const entry = {
      id: 'bmw-x5-wrap',
      data: {
        servicesApplied: ['wrap', 'unknown-service'],
        car: 'BMW X5',
        year: 2021,
        image: undefined,
      },
    } as unknown as CollectionEntry<'detailingCases'>;

    const item = toDetailingCaseItem(entry, 'ru');
    expect(item.href).toBe('/ru/detailing-belgrade/bmw-x5-wrap/');
    expect(item.badges).toEqual(['Оклейка плёнкой', 'unknown-service']);
  });
});

describe('getCaseTranslation', () => {
  const data = {
    translations: {
      en: { title: 'BMW X1', body: 'English body' },
    },
  };

  it('always returns undefined for ru — the source language, not a translation target', () => {
    expect(getCaseTranslation(data, 'ru')).toBeUndefined();
  });

  it('returns the stored translation for a locale that has one', () => {
    expect(getCaseTranslation(data, 'en')).toEqual({ title: 'BMW X1', body: 'English body' });
  });

  it('returns undefined for a locale with no translation yet, so the caller falls back to ru', () => {
    expect(getCaseTranslation(data, 'de')).toBeUndefined();
  });

  it('returns undefined when the entry has no translations field at all', () => {
    expect(getCaseTranslation({}, 'en')).toBeUndefined();
  });

  it('returns undefined for a blank stored translation (Keystatic saves unfilled fields as "", not omitted)', () => {
    const blank = { translations: { es: { title: '', body: '' } } };
    expect(getCaseTranslation(blank, 'es')).toBeUndefined();
  });
});
