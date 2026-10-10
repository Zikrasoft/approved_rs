import { describe, it, expect } from 'vitest';
import { captureCopySchema } from './copy.ts';

const COPY = {
  greeting: 'Привет',
  lookingFor: 'Что ищете?',
  budget: 'Бюджет?',
  phoneAsk: 'Номер?',
  phoneOffer: 'Позвонить?',
  phoneButton: 'Поделиться',
  phoneSkip: 'Пропустить',
  thanks: 'Спасибо',
  received: 'Получили',
  menu: { text: 'Чем помочь?', back: 'Назад' },
  services: { button: 'Услуги', text: 'Выберите услугу' },
  card: { request: 'Оставить заявку', site: 'На сайте' },
};

describe('the dialog copy a site supplies', () => {
  it('accepts a complete set of questions', () => {
    expect(captureCopySchema.parse(COPY)).toEqual(COPY);
  });

  it('refuses a set with a question missing', () => {
    const incomplete: Record<string, unknown> = { ...COPY };
    delete incomplete.budget;

    expect(captureCopySchema.safeParse(incomplete).success).toBe(false);
  });

  it('refuses a key the dialog would never ask for', () => {
    expect(
      captureCopySchema.safeParse({ ...COPY, farewell: 'Пока' }).success,
    ).toBe(false);
  });
});
