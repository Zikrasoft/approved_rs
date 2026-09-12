import { describe, it, expect } from 'vitest';
import { decideAction } from './translateDecision';

describe('decideAction', () => {
  const targetLocales = ['en', 'sr', 'es', 'de'] as const;
  const hasAll = () => true;
  const hasNone = () => false;

  it('skips when the stored hash matches and every locale has real content', () => {
    expect(
      decideAction({
        targetLocales,
        storedHash: 'a',
        currentHash: 'a',
        hasReal: hasAll,
      }),
    ).toEqual({ kind: 'skip' });
  });

  it('backfills when ru is unchanged and every locale already has content', () => {
    expect(
      decideAction({
        targetLocales,
        storedHash: undefined,
        currentHash: 'a',
        hasReal: hasAll,
      }),
    ).toEqual({ kind: 'backfill' });
  });

  it('translates every locale on first run with nothing translated yet', () => {
    expect(
      decideAction({
        targetLocales,
        storedHash: undefined,
        currentHash: 'a',
        hasReal: hasNone,
      }),
    ).toEqual({ kind: 'translate', locales: ['en', 'sr', 'es', 'de'] });
  });

  it('translates every locale when the stored hash disagrees (ru changed)', () => {
    expect(
      decideAction({
        targetLocales,
        storedHash: 'old',
        currentHash: 'new',
        hasReal: hasAll,
      }),
    ).toEqual({ kind: 'translate', locales: ['en', 'sr', 'es', 'de'] });
  });

  it('translates only the locales missing real content when ru is unchanged', () => {
    expect(
      decideAction({
        targetLocales,
        storedHash: 'a',
        currentHash: 'a',
        hasReal: (l) => l !== 'es',
      }),
    ).toEqual({ kind: 'translate', locales: ['es'] });
  });

  it('works for a business with a shorter locale list', () => {
    expect(
      decideAction({
        targetLocales: ['sr', 'en'] as const,
        storedHash: undefined,
        currentHash: 'a',
        hasReal: hasNone,
      }),
    ).toEqual({ kind: 'translate', locales: ['sr', 'en'] });
  });
});
