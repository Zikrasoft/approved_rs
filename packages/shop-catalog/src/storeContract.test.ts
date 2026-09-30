import { describe, expect, it } from 'vitest';
import * as contract from './storeContract.ts';

describe('store contract', () => {
  it('pins the names Medusa guards and the storefront sends', () => {
    expect({ ...contract }).toEqual({
      CART_METADATA: {
        honeypot: 'website',
        comment: 'comment',
        channel: 'contact_channel',
        preview: 'preview',
      },
      SHOP_COUNTRY: 'rs',
      SHOP_CURRENCY: 'rsd',
      PICKUP_OPTION_CODE: 'pickup',
      PAYMENT_PROVIDER: 'pp_system_default',
      PUBLISHABLE_KEY_HEADER: 'x-publishable-api-key',
    });
  });
});
