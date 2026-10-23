import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

describe('CommonJS build', () => {
  it('serves the contact channels, limits and contact check to require()', () => {
    expect(require.resolve('@podbor/lead-crm/phone')).toMatch(
      /dist\/cjs\/phone\.js$/,
    );
    expect(
      require('@podbor/lead-crm/contact-channel').TRACKED_CONTACT_CHANNELS,
    ).toContain('viber');
    expect(require('@podbor/lead-crm/limits').MAX_COMMENT_LENGTH).toBe(2000);
    expect(require('@podbor/lead-crm/fields').AD_SOURCE_FIELD).toBe(
      'ad_source',
    );
    expect(require('@podbor/lead-crm/fields').ORDER_ID_FIELD).toBe('order_id');
    expect(require('@podbor/lead-crm/parts-order-copy').dayWord(2)).toBe('дня');
    expect(
      require('@podbor/lead-crm/phone').isValidContact(
        '@carlab_rs',
        'telegram',
      ),
    ).toBe(true);
  });
});
