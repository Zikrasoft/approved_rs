import { describe, it, expect } from 'vitest';
import { telegramContact, typedAsPhone } from './contactShape.ts';

describe('typedAsPhone', () => {
  it.each([
    '0641234567',
    '064 123 4567',
    '+381641234567',
    '+381 64 123-4567',
    '00381641234567',
    '(064) 123.4567',
  ])('reads %s as a number, not a username', (typed) => {
    expect(typedAsPhone(typed)).toBe(true);
  });

  it.each(['', '@ivan', 'ivan', '@0641234567', 'ivan64', '+'])(
    'reads %p as a username attempt',
    (typed) => {
      expect(typedAsPhone(typed)).toBe(false);
    },
  );
});

describe('telegramContact', () => {
  it('prefixes a bare handle', () => {
    expect(telegramContact('ivan')).toBe('@ivan');
  });

  it('keeps a handle that already carries one @', () => {
    expect(telegramContact(' @ivan ')).toBe('@ivan');
  });

  it('collapses a double @ a paste can leave behind', () => {
    expect(telegramContact('@@ivan')).toBe('@ivan');
  });

  it('leaves an empty field empty instead of posting a bare @', () => {
    expect(telegramContact('   ')).toBe('');
  });
});
