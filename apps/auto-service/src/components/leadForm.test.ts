import { describe, expect, it } from 'vitest';
import { content } from '@/i18n/content';
import LeadForm from './LeadForm.astro';
import VinInquiryForm from './VinInquiryForm.astro';
import PartsInquiry from './PartsInquiry.astro';
import QuantityStepper from './QuantityStepper.astro';
import { render } from './renderAstro';

const { site, pages } = content('sr');
const inquiry = pages.partsInquiry;

const leadForm = (props: Record<string, unknown> = {}) =>
  render(LeadForm, { path: '/sr/contact/', props });

const tabs = (root: Element) =>
  [...root.querySelectorAll<HTMLElement>('[data-tab]')].map((tab) => [
    tab.dataset.tab,
    tab.textContent?.trim(),
    tab.getAttribute('aria-selected'),
  ]);

describe('the lead form', () => {
  it('asks only how to reach the visitor, with the call tab first and chosen', async () => {
    const root = await leadForm();

    expect(tabs(root)).toEqual([
      ['phone', site.form.channelPhone, 'true'],
      ['whatsapp', site.channels.whatsapp, 'false'],
      ['viber', site.channels.viber, 'false'],
      ['telegram', site.channels.telegram, 'false'],
    ]);
    expect(
      root.querySelector('[name="contact_channel"]')?.getAttribute('value'),
    ).toBe('phone');
  });

  it('keeps the name and comment one tap away, closed', async () => {
    const root = await leadForm();
    const details = root.querySelector('details')!;

    expect(details.hasAttribute('open')).toBe(false);
    expect(details.querySelector('summary')?.textContent?.trim()).toBe(
      site.form.moreDetails,
    );
    expect(details.querySelector('[name="name"]')).not.toBeNull();
    expect(details.querySelector('[name="comment"]')).not.toBeNull();
    expect(root.querySelector('[data-tab]')?.closest('details')).toBeNull();
  });

  it('states the privacy policy instead of asking for a box to be ticked', async () => {
    const root = await leadForm();
    const notice = root.querySelector('.lead-submit p')!;
    const link = notice.querySelector('a')!;

    expect(root.querySelector('input[type="checkbox"]')).toBeNull();
    expect(root.querySelector('[data-consent]')).toBeNull();
    expect(notice.textContent).toBe(
      `${site.form.privacyNotice} ${site.form.privacyLinkText}`,
    );
    expect(link.getAttribute('href')).toBe('/sr/privacy/');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.classList.contains('pointer-coarse:py-2.5')).toBe(true);
  });

  it('keeps the submit error the form shows when a lead does not go through', async () => {
    const error = (await leadForm()).querySelector('[data-error-submit]')!;

    expect(error.getAttribute('role')).toBe('alert');
    expect(error.hasAttribute('hidden')).toBe(true);
    expect(error.textContent?.trim()).toBe(site.form.errorSubmit);
  });

  it('names the topic a page prefilled, above the contact question', async () => {
    const root = await leadForm({ comment: 'Kočnice: ' });
    const topic = root.querySelector('form > p')!;

    expect(topic.textContent).toBe('Kočnice');
    expect(root.querySelector('textarea')?.textContent).toBe('Kočnice: ');
  });

  it('gives the comment two rows in a compact form and three otherwise', async () => {
    const rows = async (compact: boolean) =>
      (await leadForm({ compact }))
        .querySelector('textarea')
        ?.getAttribute('rows');

    expect(await rows(true)).toBe('2');
    expect(await rows(false)).toBe('3');
  });

  it('shows no topic line when nothing was prefilled', async () => {
    expect((await leadForm()).querySelector('form > p')).toBeNull();
  });
});

describe('the VIN inquiry form', () => {
  it('starts on the call tab and hides the VIN, name and comment behind its own toggle', async () => {
    const root = await render(VinInquiryForm, { path: '/sr/parts/' });
    const details = root.querySelector('details')!;

    expect(tabs(root)[0]).toEqual(['phone', site.form.channelPhone, 'true']);
    expect(details.hasAttribute('open')).toBe(false);
    expect(details.querySelector('summary')?.textContent?.trim()).toBe(
      inquiry.moreDetails,
    );
    expect(details.querySelector('[name="vin"]')).not.toBeNull();
  });

  it('opens the toggle when the page already knows the VIN, so the visitor sees it', async () => {
    const root = await render(VinInquiryForm, {
      path: '/sr/parts/',
      props: { vin: 'WBA35BG070N074158' },
    });
    const details = root.querySelector('details')!;

    expect(details.hasAttribute('open')).toBe(true);
    expect(details.querySelector('[name="vin"]')?.getAttribute('value')).toBe(
      'WBA35BG070N074158',
    );
  });
});

describe('the parts inquiry list', () => {
  it('keeps the list heading for screen readers only and makes room for the VIN on the car line', async () => {
    const root = await render(PartsInquiry, { path: '/sr/parts/' });
    const heading = [...root.querySelectorAll('p')].find(
      (p) => p.textContent === inquiry.listHeading,
    )!;

    expect(heading.classList.contains('sr-only')).toBe(true);
    expect(
      root.querySelector('[data-parts-car] [data-parts-car-vin]'),
    ).not.toBeNull();
  });
});

describe('the quantity stepper', () => {
  const stepSize = async (props: Record<string, unknown>) =>
    (await render(QuantityStepper, { path: '/sr/parts/', props }))
      .querySelector('[data-increase]')!
      .classList.contains('size-9');

  it('shrinks its buttons to fit a parts row in the inquiry', async () => {
    expect(await stepSize({ size: 'sm' })).toBe(true);
  });

  it('keeps full-size buttons everywhere else', async () => {
    expect(await stepSize({})).toBe(false);
  });
});
