import { describe, expect, it } from 'vitest';
import {
  COPY_PHONE_DIGITS_ATTRIBUTE,
  COPY_PHONE_NUMBER_ATTRIBUTE,
} from '@podbor/site-kit/browser';
import LeadModal from './LeadModal.astro';
import { render } from './renderAstro';

const dialog = async (path = '/ru/') =>
  (await render(LeadModal, { path })).querySelector('dialog')!;

describe('the lead modal', () => {
  it('offers the workshop number as a quiet line under the description', async () => {
    const line = (await dialog()).querySelector(
      '[data-contact-placement="modal"]',
    )!;

    expect(line.textContent?.replace(/\s+/g, ' ')).toContain(
      'Или позвоните: +381 67 7210533',
    );
  });

  it('dials on a touchscreen and copies the number on a mouse', async () => {
    const line = (await dialog()).querySelector(
      '[data-contact-placement="modal"]',
    )!;
    const call = line.querySelector('a[href^="tel:"]')!;
    const copy = line.querySelector(`[${COPY_PHONE_NUMBER_ATTRIBUTE}]`)!;

    expect(call.getAttribute('href')).toBe('tel:+381677210533');
    expect(call.getAttribute('data-contact-channel')).toBe('phone');
    expect(call.classList.contains('pointer-fine:hidden!')).toBe(true);
    expect(
      copy.parentElement!.classList.contains('pointer-coarse:hidden!'),
    ).toBe(true);
    expect(copy.querySelector('button')!.dataset.contactChannel).toBe('phone');
    expect(
      copy.querySelector(`[${COPY_PHONE_DIGITS_ATTRIBUTE}]`)!.textContent,
    ).toBe('+381 67 7210533');
  });

  it('keeps every contact control in the modal inside a placement', async () => {
    const controls = (await dialog()).querySelectorAll(
      '[data-contact-channel]',
    );

    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls)
      expect(control.closest('[data-contact-placement]')).not.toBeNull();
  });

  it('leaves the line visually quiet beside the orange submit', async () => {
    const call = (await dialog()).querySelector(
      '[data-contact-placement="modal"] a[href^="tel:"]',
    )!;

    expect(call.className).not.toMatch(/\b(btn|bg-signal|text-signal)/);
  });
});
