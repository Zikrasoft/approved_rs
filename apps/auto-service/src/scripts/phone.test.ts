// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { loadPhoneKit } from '@podbor/lead-crm/phone-kit';
import { phoneInvalid } from './phone';

describe('phoneInvalid before the phone kit has loaded', () => {
  it('rejects an empty field', () => {
    expect(phoneInvalid(' ', '+381')).toBe(true);
  });

  it('accepts only a plausible international number', () => {
    expect(phoneInvalid('060 123 4567', '+381601234567')).toBe(false);
    expect(phoneInvalid('12', '+38112')).toBe(true);
  });
});

describe('phoneInvalid with the kit loaded', () => {
  it('defers to the kit once it has loaded', async () => {
    await loadPhoneKit();

    expect(phoneInvalid('060 1', '+381601')).toBe(true);
    expect(phoneInvalid('060 123 4567', '+381601234567')).toBe(false);
  });
});
