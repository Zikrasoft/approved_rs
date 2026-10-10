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
    ['12.345', 12.35, ''],
    ['40\nИван\nсервис', 40, 'Иван\nсервис'],
  ])('reads %j as %d with note %j', (text, amount, note) => {
    expect(parseOperationReply(text)).toEqual({ amount, note });
  });

  it.each(['', 'Иван', 'сорок', '40Иван', '-40', '0', '0,001', '1000001'])(
    'finds no amount in %j',
    (text) => {
      expect(parseOperationReply(text)).toBeNull();
    },
  );
});
