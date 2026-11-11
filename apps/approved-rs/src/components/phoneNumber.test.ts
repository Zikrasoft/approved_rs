import { describe, expect, it } from 'vitest';
import {
  COPY_PHONE_DIGITS_ATTRIBUTE,
  COPY_PHONE_NUMBER_ATTRIBUTE,
  COPY_PHONE_STATUS_ATTRIBUTE,
} from '@podbor/site-kit/browser';
import phoneNumber from './PhoneNumber.astro?raw';
import contactControl from './ContactControl.astro?raw';

const sources = import.meta.glob<string>('/src/**/*.astro', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('PhoneNumber', () => {
  it('is the only markup that renders the phone digits', () => {
    const rendering = Object.entries(sources)
      .filter(([, source]) => source.includes('formatPhone('))
      .map(([path]) => path);

    expect(rendering).toEqual(['/src/components/PhoneNumber.astro']);
  });

  it('stamps the copy contract through the site-kit constants, never a literal', () => {
    for (const attribute of [
      COPY_PHONE_NUMBER_ATTRIBUTE,
      COPY_PHONE_DIGITS_ATTRIBUTE,
      COPY_PHONE_STATUS_ATTRIBUTE,
    ])
      expect(phoneNumber).not.toContain(attribute);
    expect(phoneNumber).toContain('<button');
    expect(phoneNumber).toContain('type="button"');
    expect(phoneNumber).toContain('aria-live="polite"');
    expect(phoneNumber).toContain('defineCopyPhone()');
  });

  it('gives the mouse a copy control the contact-click tracking counts', () => {
    expect(contactControl).toContain('<PhoneNumber copy {...control.attrs} />');
  });
});
