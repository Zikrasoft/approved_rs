import { describe, it, expect } from 'vitest';
import {
  isTelegramIdContact,
  telegramContact,
  typedAsPhone,
} from './contactShape.ts';

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

  it.each([
    'https://t.me/ivan',
    'http://t.me/ivan/',
    't.me/ivan',
    'https://telegram.me/ivan',
    'telegram.me/@ivan/',
    'https://www.t.me/ivan',
    ' T.ME/ivan ',
  ])('takes the handle out of a profile link: %s', (link) => {
    expect(telegramContact(link)).toBe('@ivan');
  });

  it('leaves a link that is not a profile link for validation to reject', () => {
    expect(telegramContact('https://example.com/ivan')).toBe(
      '@https://example.com/ivan',
    );
  });
});

describe('isTelegramIdContact', () => {
  it('matches the id link the capture bot stores for a visitor without a handle', () => {
    expect(isTelegramIdContact('tg://user?id=123456')).toBe(true);
  });

  it.each(['@ivan', '+381601234567', ''])('rejects %p', (contact) => {
    expect(isTelegramIdContact(contact)).toBe(false);
  });
});
