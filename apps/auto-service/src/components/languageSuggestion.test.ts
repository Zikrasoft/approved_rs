import { describe, expect, it } from 'vitest';
import LanguageSuggestion from './LanguageSuggestion.astro';
import SiteHeader from './SiteHeader.astro';
import { render } from './renderAstro';

describe('LanguageSuggestion', () => {
  it('is a positioned popover, so showing it moves nothing', async () => {
    const root = await render(LanguageSuggestion, { path: '/ru/' });
    const host = root.querySelector('language-suggestion')!;

    expect(host.hasAttribute('hidden')).toBe(true);
    expect(host.classList).toContain('absolute');
    expect(host.getAttribute('role')).toBe('region');
    expect(host.querySelector('[data-lang-prompt]')).not.toBeNull();
    expect(host.querySelector('[data-lang-link]')).not.toBeNull();
    expect(host.querySelector('[data-lang-dismiss]')).not.toBeNull();
  });

  it('offers the switch as a quiet button, leaving the orange to the page', async () => {
    const root = await render(LanguageSuggestion, { path: '/ru/' });
    const link = root.querySelector('[data-lang-link]')!;

    expect(link.classList).toContain('btn-on-panel');
    expect(link.classList).not.toContain('btn-primary');
  });

  it('sits in the header beside the language pills', async () => {
    const root = await render(SiteHeader, { path: '/ru/' });
    const pills = root.querySelector('header carlab-lang')!;

    expect(
      pills.parentElement!.querySelector('language-suggestion'),
    ).not.toBeNull();
  });
});
