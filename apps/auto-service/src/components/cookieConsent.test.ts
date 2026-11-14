import { describe, expect, it } from 'vitest';
import CookieConsent from './CookieConsent.astro';
import LanguageSuggestion from './LanguageSuggestion.astro';
import { render } from './renderAstro';

const classes = (element: Element) => element.className.split(/\s+/);

describe('the site-wide prompts on a touchscreen', () => {
  it('give the cookie choice buttons a 44px tap target', async () => {
    const root = await render(CookieConsent, { path: '/ru/' });
    const buttons = [
      ...root.querySelectorAll('[data-consent-decline], [data-consent-accept]'),
    ];

    expect(buttons).toHaveLength(2);
    buttons.forEach((button) =>
      expect(classes(button)).toContain('pointer-coarse:min-h-11'),
    );
  });

  it('give the language switch a 44px tap target', async () => {
    const root = await render(LanguageSuggestion, { path: '/ru/' });

    expect(classes(root.querySelector('[data-lang-link]')!)).toContain(
      'pointer-coarse:h-11',
    );
  });
});
