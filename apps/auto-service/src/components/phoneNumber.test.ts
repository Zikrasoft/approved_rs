import { describe, expect, it } from 'vitest';
import {
  COPY_PHONE_DIGITS_ATTRIBUTE,
  COPY_PHONE_NUMBER_ATTRIBUTE,
  COPY_PHONE_STATUS_ATTRIBUTE,
} from '@podbor/site-kit/browser';
import phoneNumber from './PhoneNumber.astro?raw';
import contactControl from './ContactControl.astro?raw';
import { formatPhone } from '@podbor/site-kit/format-phone';
import { content } from '@/i18n/content';
import { PHONE_NUMBER } from '@/utils/constants';
import ContactControl from './ContactControl.astro';
import { render } from './renderAstro';

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

  it('renders a copy button that carries the canonical number and the copy wording', async () => {
    const root = await render(ContactControl, {
      path: '/ru/services/',
      props: { channel: 'phone', showNumber: true },
    });
    const host = root.querySelector('copy-phone')!;
    const button = host.querySelector('button')!;
    const status = host.querySelector(`[${COPY_PHONE_STATUS_ATTRIBUTE}]`)!;
    const { copyPhone } = content('ru').site;

    expect(host.getAttribute(COPY_PHONE_NUMBER_ATTRIBUTE)).toBe(
      `+${PHONE_NUMBER}`,
    );
    expect(button.getAttribute('type')).toBe('button');
    expect(button.dataset.contactChannel).toBe('phone');
    expect(button.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      `${copyPhone.label} ${formatPhone(PHONE_NUMBER)}`,
    );
    expect(
      button.querySelector(`[${COPY_PHONE_DIGITS_ATTRIBUTE}]`)!.textContent,
    ).toContain(formatPhone(PHONE_NUMBER));
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.getAttribute(COPY_PHONE_STATUS_ATTRIBUTE)).toBe(
      copyPhone.copied,
    );
    expect(status.textContent).toBe('');
  });
});
