import { describe, it, expect } from 'vitest';
import { editedContact } from './editedContact.ts';

describe('editedContact', () => {
  it.each([
    [
      '064 123 4567',
      null,
      { contact: '+381641234567', contactChannel: 'phone' },
    ],
    [
      '+381 64 123 4567',
      'viber',
      { contact: '+381641234567', contactChannel: 'viber' },
    ],
    [
      '+381641234567',
      'telegram',
      { contact: '+381641234567', contactChannel: 'phone' },
    ],
    ['@petr', 'whatsapp', { contact: '@petr', contactChannel: 'telegram' }],
    ['t.me/petr', null, { contact: '@petr', contactChannel: 'telegram' }],
    [
      'petr@mail.rs',
      'phone',
      { contact: 'petr@mail.rs', contactChannel: null },
    ],
    [
      ' https://instagram.com/petr ',
      null,
      { contact: 'https://instagram.com/petr', contactChannel: null },
    ],
  ])('takes %j (was %s)', (typed, channel, expected) => {
    expect(editedContact(typed, channel, 'RS')).toEqual(expected);
  });

  it.each([
    '',
    '   ',
    '+381 1',
    'не знаю',
    'javascript:alert(1)',
    'http://localhost',
  ])('refuses %j', (typed) => {
    expect(editedContact(typed, null, 'RS')).toBeUndefined();
  });
});
