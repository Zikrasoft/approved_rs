import { describe, expect, it } from 'vitest';
import {
  fitConditions,
  fitNote,
  fitPosition,
  fitQuantity,
} from './fitmentLabels';

const fit = {
  quantity: 2,
  axle: null,
  side: null,
  production_from: null,
  production_to: null,
  gearbox: null,
  steering: null,
  note: null,
  translations: null,
} as const;

describe('fitPosition', () => {
  it('names the axle and side in the page language', () => {
    expect(fitPosition({ ...fit, axle: 'front', side: 'left' }, 'ru')).toBe(
      'передняя ось, слева',
    );
  });

  it('says nothing for a part without a position', () => {
    expect(fitPosition(fit, 'ru')).toBe('');
  });
});

describe('fitConditions', () => {
  it('lists steering, gearbox and production dates', () => {
    expect(
      fitConditions(
        {
          ...fit,
          steering: 'right',
          gearbox: 'automatic',
          production_from: '2016-03-01T00:00:00.000Z',
          production_to: '2019-06-30T00:00:00.000Z',
        },
        'ru',
      ),
    ).toEqual([
      'правый руль',
      'автоматическая КПП',
      'выпуск с 03.2016',
      'выпуск по 06.2019',
    ]);
  });

  it('lists nothing for an unconditional fit', () => {
    expect(fitConditions(fit, 'ru')).toEqual([]);
  });
});

describe('fitNote', () => {
  it('serves the translated note and falls back to Russian', () => {
    const noted = {
      ...fit,
      note: 'Только с M-пакетом',
      translations: { sr: { note: 'Samo sa M paketom' } },
    };

    expect(fitNote(noted, 'sr')).toBe('Samo sa M paketom');
    expect(fitNote(noted, 'en')).toBe('Только с M-пакетом');
    expect(fitNote(fit, 'sr')).toBeNull();
  });
});

describe('fitQuantity', () => {
  it('counts the pieces a car needs', () => {
    expect(fitQuantity(fit, 'ru')).toBe('2 шт.');
  });
});
