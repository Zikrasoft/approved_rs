import { describe, it, expect } from 'vitest';
import { parseOperationReply } from './operationReply.ts';

describe('parseOperationReply', () => {
  it.each([
    ['40', 40, ''],
    ['40 Иван сервис', 40, 'Иван сервис'],
    ['  40,5   ', 40.5, ''],
    ['40.25 € за масло', 40.25, 'за масло'],
    ['40€', 40, ''],
    ['40 евро.', 40, ''],
    ['40 ЕВРО. Иван', 40, 'Иван'],
    ['40.', 40, ''],
    ['0,01', 0.01, ''],
    ['1000000', 1_000_000, ''],
    ['40\nИван\nсервис', 40, 'Иван\nсервис'],
  ])('reads %j as %d with note %j', (text, amount, note) => {
    expect(parseOperationReply(text)).toEqual({ ok: true, amount, note });
  });

  it.each(['', 'Иван', 'сорок', '40Иван', '-40'])(
    'finds no number in %j',
    (text) => {
      expect(parseOperationReply(text)).toEqual({
        ok: false,
        reason: 'no_number',
      });
    },
  );

  it.each(['0', '0,00', '12.345', '0,001', '1000000.01', '1000001'])(
    'refuses %j as an amount instead of rounding or capping it',
    (text) => {
      expect(parseOperationReply(text)).toEqual({
        ok: false,
        reason: 'bad_amount',
      });
    },
  );
});
