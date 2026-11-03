import { describe, expect, it } from 'vitest';
import LanguageSuggestion from './LanguageSuggestion.astro';
import { render } from './renderAstro';

describe('LanguageSuggestion', () => {
  it('overlays the page from a zero-height slot, so showing it moves nothing', async () => {
    const root = await render(LanguageSuggestion, { path: '/ru/' });
    const host = root.querySelector('language-suggestion')!;
    const bar = host.firstElementChild!;

    expect(host.hasAttribute('hidden')).toBe(true);
    expect(host.classList).toContain('h-0');
    expect(bar.classList).toContain('absolute');
    expect(host.querySelector('[data-lang-link]')).not.toBeNull();
    expect(host.querySelector('[data-lang-dismiss]')).not.toBeNull();
  });
});
