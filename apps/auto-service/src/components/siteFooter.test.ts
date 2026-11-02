import { describe, expect, it } from 'vitest';
import { DEVELOPER_CREDIT_ATTRIBUTE } from '@podbor/site-kit/browser';
import { content } from '@/i18n/content';
import SiteFooter from './SiteFooter.astro';
import { orangeIn, render } from './renderAstro';

const site = content('ru').site;

describe('SiteFooter', async () => {
  const footer = await render(SiteFooter, { path: '/ru/services/' });
  const contacts = footer.querySelector('[data-contact-placement="footer"]')!;
  const before = (a: Element, b: Element) =>
    Boolean(a.compareDocumentPosition(b) & 4);

  it('puts the address, hours and call above the link lists on a phone', () => {
    const address = contacts.querySelector(
      'a[href^="https://maps.google.com"]',
    )!;
    const firstNav = footer.querySelector('nav')!;

    expect(address.textContent).toContain('Jovana Ćirilova 23a');
    expect(contacts.textContent).toContain(site.hours.week);
    expect(before(address, firstNav)).toBe(true);
  });

  it('labels the touch call with the number and gives a mouse the callback', () => {
    const call = contacts.querySelector('a[href^="tel:"]')!;
    const callback = contacts.querySelector('[data-open-lead-modal="phone"]')!;

    expect(call.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Позвонить +381 67 7210533',
    );
    expect(call.classList.contains('btn-secondary')).toBe(true);
    expect(callback.classList.contains('btn-secondary')).toBe(true);
  });

  it('keeps the footer out of the regions that hide the floating bar', () => {
    expect(footer.querySelector('[data-contact-cta]')).toBeNull();
  });

  it('credits the developer quietly, beside the orange call', () => {
    const credit = footer.querySelector(`[${DEVELOPER_CREDIT_ATTRIBUTE}]`)!;

    expect(credit.textContent).toContain('Zikrasoft');
    expect(orangeIn(credit)).toEqual([]);
  });

  it('sets the two link lists side by side', () => {
    const navs = [...footer.querySelectorAll('nav')];

    expect(navs).toHaveLength(2);
    expect(navs[0].parentElement).toBe(navs[1].parentElement);
    expect(navs[0].parentElement?.classList.contains('grid-cols-2')).toBe(true);
    expect(footer.textContent).toContain(site.footer.aboutLabel);
  });
});
