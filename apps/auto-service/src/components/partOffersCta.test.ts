import { describe, expect, it } from 'vitest';
import partOffers from './PartOffers.astro?raw';
import offerRow from './OfferRow.astro?raw';
import partOffersScript from '../scripts/partOffers.ts?raw';

const openingTag = (source: string, tag: string) =>
  source.match(new RegExp(`<${tag}[\\s\\S]*?\\n\\s*>`))?.[0] ?? '';

describe('the in-flow contact marker on a priced part', () => {
  it('stays off the offers card, so a sliver of the card cannot hide the sticky bar', () => {
    expect(openingTag(partOffers, 'part-offers')).not.toBe('');
    expect(openingTag(partOffers, 'part-offers')).not.toContain('contactCta');
  });

  it('sits on the best offer buttons only', () => {
    expect(partOffers.match(/inFlow/g)).toHaveLength(1);
    expect(partOffers).toContain(
      '<OfferRow offer={best} inFlow askHref={askHref} />',
    );
    expect(offerRow).toMatch(/\{\.\.\.\(?inFlow && contactCta\)?\}/);
  });

  it('survives the live refresh, which fills the shown row instead of replacing the watched node', () => {
    expect(partOffersScript).toContain('this.fillRow(shown, best)');
  });
});
