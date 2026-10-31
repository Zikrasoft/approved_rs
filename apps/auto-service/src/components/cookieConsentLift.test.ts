import { describe, expect, it } from 'vitest';
import { COOKIE_CONSENT_HEIGHT_VAR } from '@podbor/site-kit/browser';
import partStickyCta from './PartStickyCta.astro?raw';
import stickyContactBar from './StickyContactBar.astro?raw';

const lifts = (source: string) =>
  source.split(`var(${COOKIE_CONSENT_HEIGHT_VAR},`).length - 1;

describe('bars fixed to the bottom of the screen', () => {
  it.each([
    ['PartStickyCta', partStickyCta, 1],
    ['StickyContactBar', stickyContactBar, 1],
  ])('%s rises above the cookie banner', (_, source, sites) => {
    expect(lifts(source)).toBe(sites);
  });
});
