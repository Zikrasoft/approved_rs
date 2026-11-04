import { describe, expect, it } from 'vitest';
import { fitSummary, type MakeFits } from './fitGroups';

const groups = (...makes: string[][]) =>
  makes.map((models) => ({
    make: {},
    models: models.map((slug) => ({ model: { slug }, fits: [] })),
  })) as unknown as MakeFits[];

const slug = (model: { slug: string }) => model.slug;

describe('fitSummary', () => {
  it('names the first two models across makes and counts the rest', () => {
    expect(fitSummary(groups(['f30', 'f31'], ['x1', 'x3']), slug)).toEqual({
      names: 'f30, f31',
      more: 2,
    });
  });

  it('names a single model with nothing more', () => {
    expect(fitSummary(groups(['f30']), slug)).toEqual({
      names: 'f30',
      more: 0,
    });
  });

  it('gives nothing for a part with no fits', () => {
    expect(fitSummary([], slug)).toBeNull();
  });
});
