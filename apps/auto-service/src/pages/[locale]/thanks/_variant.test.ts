import { describe, expect, it } from 'vitest';
import { content } from '@/i18n/content';
import { render } from '@/components/renderAstro';
import ThanksPage from './[...variant].astro';

const { pages, site } = content('ru');
const page = (variant?: string) =>
  render(ThanksPage as never, {
    path: variant ? '/ru/thanks/parts/' : '/ru/thanks/',
    params: { locale: 'ru', variant },
  });
const backLinks = (root: Element) =>
  [...root.querySelectorAll('section a')]
    .map((link) => link.textContent?.trim())
    .filter(
      (label) => label === pages.thanks.cta || label === pages.thanksParts.cta,
    );

describe('the thanks page', () => {
  it('labels the call with the number on a touchscreen', async () => {
    const call = (await page()).querySelector('main .card a[href^="tel:"]')!;

    expect(call.textContent?.trim()).toBe('+381 67 7210533');
  });

  it('says where to come, with the hours and a route', async () => {
    const root = await page();

    expect(root.textContent).toContain(pages.thanks.visitLabel);
    expect(root.textContent).toContain('Jovana Ćirilova 23a');
    expect(root.textContent).toContain(site.hours.saturday);
    expect(
      root
        .querySelector('a[href^="https://www.google.com/maps/dir/"]')
        ?.textContent?.trim(),
    ).toBe(site.visit.route);
  });

  it('sends a repair visitor home without offering parts', async () => {
    expect(backLinks(await page())).toEqual([pages.thanks.cta]);
  });

  it('sends a parts visitor back to the parts', async () => {
    expect(backLinks(await page('parts'))).toEqual([pages.thanksParts.cta]);
  });
});
