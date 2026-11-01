import { describe, expect, it } from 'vitest';
import { content } from '@/i18n/content';
import { SERVICE_SLUGS } from '@/utils/services';
import ServiceList from './ServiceList.astro';
import { render } from './renderAstro';

const services = content('ru').services;

describe('ServiceList', () => {
  it('links every service as one row with its duration and no price', async () => {
    const rows = [
      ...(await render(ServiceList, { path: '/ru/' })).querySelectorAll('li a'),
    ];

    expect(rows.map((row) => row.getAttribute('href'))).toEqual(
      SERVICE_SLUGS.map((slug) => `/ru/services/${slug}/`),
    );
    SERVICE_SLUGS.forEach((slug, i) => {
      expect(rows[i].textContent).toContain(services[slug].name);
      expect(rows[i].textContent).toContain(services[slug].duration);
      expect(rows[i].textContent).not.toContain(services[slug].priceFrom);
      expect(rows[i].textContent).not.toContain('€');
    });
  });

  it('keeps the short description off the phone layout', async () => {
    const short = (await render(ServiceList, { path: '/ru/' })).querySelector(
      'li a span span:nth-child(2)',
    )!;

    expect(short.textContent?.trim()).toBe(services.diagnostics.short);
    expect(short.classList.contains('max-lg:hidden')).toBe(true);
  });
});
