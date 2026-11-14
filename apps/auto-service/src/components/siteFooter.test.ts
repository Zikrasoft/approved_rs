import { describe, expect, it } from 'vitest';
import { DEVELOPER_CREDIT_ATTRIBUTE } from '@podbor/site-kit/browser';
import { content } from '@/i18n/content';
import { formatPhone } from '@podbor/site-kit/format-phone';
import { PHONE_NUMBER } from '@/utils/constants';
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

  it('shows the digits on a tappable call, as text to a mouse, and keeps the callback', () => {
    const number = formatPhone(PHONE_NUMBER);
    const call = contacts.querySelector('a[href^="tel:"]')!;
    const plain = call.nextElementSibling!;
    const callback = contacts.querySelector('[data-open-lead-modal="phone"]')!;

    expect(call.textContent?.replace(/\s+/g, ' ').trim()).toBe(number);
    expect(call.classList.contains('pointer-fine:hidden!')).toBe(true);
    expect(plain.tagName).toBe('SPAN');
    expect(plain.textContent).toContain(number);
    expect(plain.classList.contains('pointer-coarse:hidden!')).toBe(true);
    expect(call.classList.contains('btn-secondary')).toBe(true);
    expect(callback.classList.contains('btn-secondary')).toBe(true);
  });

  it('shows the Google rating beside the tagline', () => {
    expect(footer.textContent).toContain('5.0 в Google · 22 отзыва');
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

  it('leads to the blog under «Блог», after the Works', () => {
    const company = footer.querySelectorAll('nav')[1];
    const links = [...company.querySelectorAll('a')];
    const blog = company.querySelector<HTMLAnchorElement>(
      'a[href="/ru/blog/"]',
    )!;

    expect(blog.textContent?.trim()).toBe('Блог');
    expect(links.indexOf(blog)).toBe(
      links.findIndex((link) => link.getAttribute('href') === '/ru/works/') + 1,
    );
  });

  it('leads to the Make pages under «Машины», before the Works', () => {
    const company = footer.querySelectorAll('nav')[1];
    const links = [...company.querySelectorAll('a')];
    const cars = company.querySelector<HTMLAnchorElement>(
      'a[href="/ru/cars/"]',
    )!;

    expect(cars.textContent?.trim()).toBe('Машины');
    expect(links.indexOf(cars)).toBe(
      links.findIndex((link) => link.getAttribute('href') === '/ru/works/') - 1,
    );
  });
});
