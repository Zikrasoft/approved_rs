import { describe, expect, it } from 'vitest';
import { CONSENT_FIELD } from '@podbor/lead-crm/fields';
import { content } from '@/i18n/content';
import ConsentField from './ConsentField.astro';
import { render } from './renderAstro';

const { site, shopCart } = content('sr');

const consent = () =>
  render(ConsentField, {
    path: '/sr/parts/cart/',
    props: {
      uid: 'modal',
      error: shopCart.consentError,
      submitError: shopCart.submitError,
    },
  });

describe('the consent line', () => {
  it('keeps the whole sentence as label text, so a tap on it ticks the box', async () => {
    const label = (await consent()).querySelector('label')!;

    expect(label.querySelector('a')).toBeNull();
    expect(
      label.querySelector(`input[name="${CONSENT_FIELD}"]`),
    ).not.toBeNull();
    expect(label.textContent?.trim()).toBe(
      `${site.form.privacyNote} ${site.form.privacyLinkText}.`,
    );
  });

  it('puts the privacy link after the label as its own tap target', async () => {
    const root = await consent();
    const link = root.querySelector('label + a')!;

    expect(link.getAttribute('href')).toBe('/sr/privacy/');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.classList.contains('pointer-coarse:min-h-11')).toBe(true);
  });

  it('names the policy once on screen, the full name only for screen readers', async () => {
    const link = (await consent()).querySelector('label + a')!;
    const spoken = link.querySelector('.sr-only')!;

    expect(spoken.textContent).toBe(` ${site.footer.privacyLabel}`);
    expect(link.textContent).toBe(
      `${site.form.privacyOpen} ${site.footer.privacyLabel}`,
    );
  });

  it('ties the box to its own error line', async () => {
    const root = await consent();

    expect(root.querySelector('input')?.getAttribute('aria-describedby')).toBe(
      'consent-error-modal',
    );
    expect(
      root.querySelector('#consent-error-modal')?.textContent?.trim(),
    ).toBe(shopCart.consentError);
  });

  it('keeps the submit error the checkout shows when the order does not go through', async () => {
    const root = await consent();

    expect(root.querySelector('[data-error-submit]')?.textContent?.trim()).toBe(
      shopCart.submitError,
    );
  });
});
