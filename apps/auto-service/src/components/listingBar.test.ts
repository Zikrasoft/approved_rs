import { describe, expect, it } from 'vitest';
import { content } from '@/i18n/content';
import ListingBar from './ListingBar.astro';
import { render } from './renderAstro';

const copy = content('ru').partsSearch;

const bar = async (props: Record<string, unknown>) =>
  (
    await render(ListingBar, {
      path: '/ru/parts/search/',
      props: { filters: false, ...props },
    })
  ).querySelector('p')!;

describe('the listing bar', () => {
  it('says how many were found', async () => {
    expect((await bar({ count: 5 })).textContent?.trim()).toBe(
      copy.found.replace('{count}', '5'),
    );
  });

  it('counts in the unit the page names', async () => {
    expect(
      (await bar({ count: 3, found: copy.foundNumbers })).textContent?.trim(),
    ).toBe(copy.foundNumbers.replace('{count}', '3'));
  });

  it('says no zero, leaving the page to offer the manual pick', async () => {
    expect((await bar({ count: 0 })).textContent?.trim()).toBe('');
  });
});
