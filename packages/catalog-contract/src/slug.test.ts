import { describe, expect, it } from 'vitest';
import { seriesSlugOf, slugOf } from './slug.ts';

describe('slugOf', () => {
  it.each([
    ['Đurđevac', 'djurdjevac'],
    ['ĐURĐEVAC', 'djurdjevac'],
    ['Ölfilter für Straße', 'olfilter-fur-strasse'],
    ['Łódź', 'lodz'],
    ['Søren Ørsted', 'soren-orsted'],
    ['Ærø', 'aero'],
    ['Œuvre cœur', 'oeuvre-coeur'],
    ['Kočnice i vešanje', 'kocnice-i-vesanje'],
    ['Citroën C4', 'citroen-c4'],
  ])('slugs %j as %j', (name, slug) => {
    expect(slugOf(name)).toBe(slug);
  });
});

describe('seriesSlugOf', () => {
  it.each([
    ['Polo V', 'polo-v'],
    ['3 Series', '3-series'],
    ['  Clio_IV ', 'clio-iv'],
    ['Citroën C4.Picasso', 'citroen-c4-picasso'],
  ])('slugs %j as plainly as its unique name key allows', (name, slug) => {
    expect(seriesSlugOf(name)).toBe(slug);
  });

  it('keeps apart names the series name key tells apart but a slug would not', () => {
    const plus = seriesSlugOf('C+');
    expect(seriesSlugOf('C')).toBe('c');
    expect(plus).toMatch(/^c-[a-z0-9]{6}$/);
    expect(seriesSlugOf('Polo/V')).toMatch(/^polo-v-[a-z0-9]{6}$/);
    expect(seriesSlugOf('C+')).toBe(plus);
    expect(seriesSlugOf('C&')).not.toBe(plus);
  });

  it('gives a name with no Latin letters a slug of its own', () => {
    expect(seriesSlugOf('Жигули')).toMatch(/^[a-z0-9]{6}$/);
    expect(seriesSlugOf('Жигули')).not.toBe(seriesSlugOf('Нива'));
  });
});
