import { contactFaults, isBot } from '../contact';

const CART = {
  email: 'kupac@example.com',
  shipping_address: {
    first_name: 'Marko',
    last_name: 'Marković',
    phone: '+381601234567',
    country_code: 'rs',
  },
  metadata: { comment: 'Posle 17h', contact_channel: 'viber', website: '' },
};

const withAddress = (patch: object) => ({
  ...CART,
  shipping_address: { ...CART.shipping_address, ...patch },
});

describe('contactFaults', () => {
  it('finds nothing wrong with a complete Serbian pickup order', () => {
    expect(contactFaults(CART)).toEqual([]);
  });

  it('accepts a cart with no metadata at all', () => {
    expect(contactFaults({ ...CART, metadata: null })).toEqual([]);
  });

  it.each([
    ['no contact at all', {}, ['email', 'имя и телефон']],
    ['no email', { ...CART, email: null }, ['email']],
    ['an email that is not one', { ...CART, email: 'kupac' }, ['email']],
    ['a blank name', withAddress({ first_name: '  ' }), ['имя']],
    [
      'a name longer than a card holds',
      withAddress({ first_name: 'x'.repeat(201) }),
      ['имя'],
    ],
    [
      'a local phone number',
      withAddress({ phone: '060 123 4567' }),
      ['телефон в международном формате'],
    ],
    [
      'a delivery country other than Serbia',
      withAddress({ country_code: 'ru' }),
      ['страна получения — только Сербия'],
    ],
    [
      'an essay for a comment',
      { ...CART, metadata: { comment: 'x'.repeat(2001) } },
      ['комментарий длиннее 2000 знаков'],
    ],
    [
      'an invented contact channel',
      { ...CART, metadata: { contact_channel: 'x'.repeat(41) } },
      ['способ связи'],
    ],
  ])('names %s', (_label, cart, faults) => {
    expect(contactFaults(cart)).toEqual(faults);
  });
});

describe('isBot', () => {
  it.each([
    ['an empty honeypot', { metadata: { website: '' } }, false],
    ['no honeypot field', { metadata: {} }, false],
    ['no metadata', { metadata: null }, false],
    ['no metadata key', {}, false],
    [
      'a filled honeypot',
      { metadata: { website: 'http://spam.example' } },
      true,
    ],
    ['a honeypot of spaces', { metadata: { website: '  ' } }, true],
    ['a honeypot that is not text', { metadata: { website: 1 } }, true],
  ])('reads %s', (_label, cart, bot) => {
    expect(isBot(cart)).toBe(bot);
  });
});
