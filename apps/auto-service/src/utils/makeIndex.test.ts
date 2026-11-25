import { describe, expect, it } from 'vitest';
import { makesByLetter, topMakes } from './makeIndex';
import { PathBuilder } from './paths';

const hub = (name: string, parts: number) => ({
  make: { slug: name.toLowerCase(), name },
  parts,
});

describe('topMakes', () => {
  it('picks the Makes with the most Parts, most first', () => {
    const hubs = [hub('Audi', 4), hub('BMW', 30), hub('MINI', 12)];

    expect(topMakes(hubs, 2).map(({ make }) => make.name)).toEqual([
      'BMW',
      'MINI',
    ]);
  });
});

describe('makesByLetter', () => {
  it('groups the Makes under their first letter in name order', () => {
    const makes = ['Volvo', 'alpina', 'Audi', 'BMW', '3M'].map((name) => ({
      slug: name.toLowerCase(),
      name,
    }));

    expect(
      makesByLetter(makes).map(({ letter, makes }) => [
        letter,
        makes.map(({ name }) => name),
      ]),
    ).toEqual([
      ['#', ['3M']],
      ['A', ['alpina', 'Audi']],
      ['B', ['BMW']],
      ['V', ['Volvo']],
    ]);
  });
});

describe('the all-makes page', () => {
  it('lives under /parts/makes/', () => {
    expect(PathBuilder.partsMakes('sr')).toBe('/sr/parts/makes/');
  });
});
