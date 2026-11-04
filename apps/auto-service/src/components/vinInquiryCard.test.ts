import { describe, expect, it } from 'vitest';
import card from './VinInquiryCard.astro?raw';

const sources = import.meta.glob<string>(['../pages/**/*.astro', './*.astro'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('the VIN inquiry form', () => {
  it('is spelled once, so its copy cannot drift', () => {
    const spellings = Object.entries(sources).filter(([, source]) =>
      /<LeadForm\s+service={VIN_INQUIRY_SERVICE}/.test(source),
    );
    expect(spellings.map(([path]) => path)).toEqual(['./VinInquiryForm.astro']);
  });

  it('sits in a card that hides the sticky contact bar', () => {
    expect(card).toContain('{...contactCta}');
  });
});
