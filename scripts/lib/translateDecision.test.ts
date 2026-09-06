import { describe, it, expect } from 'vitest';
import { decideAction } from './translateDecision';

describe('decideAction', () => {
  const hasAll = () => true;
  const hasNone = () => false;

  it('skips when the stored hash matches and every locale has real content', () => {
    expect(
      decideAction({ storedHash: 'a', currentHash: 'a', hasReal: hasAll }),
    ).toEqual({ kind: 'skip' });
  });

  it('backfills when ru is unchanged and every locale already has content', () => {
    expect(
      decideAction({
        storedHash: undefined,
        currentHash: 'a',
        hasReal: hasAll,
      }),
    ).toEqual({ kind: 'backfill' });
  });

  it('translates every locale on first run with nothing translated yet', () => {
    expect(
      decideAction({
        storedHash: undefined,
        currentHash: 'a',
        hasReal: hasNone,
      }),
    ).toEqual({ kind: 'translate', locales: ['en', 'sr', 'es', 'de'] });
  });

  it('translates every locale when the stored hash disagrees (ru changed)', () => {
    expect(
      decideAction({ storedHash: 'old', currentHash: 'new', hasReal: hasAll }),
    ).toEqual({ kind: 'translate', locales: ['en', 'sr', 'es', 'de'] });
  });

  it('translates only the locales missing real content when ru is unchanged', () => {
    const missingEs = (l: string) => l !== 'es';
    expect(
      decideAction({ storedHash: 'a', currentHash: 'a', hasReal: missingEs }),
    ).toEqual({ kind: 'translate', locales: ['es'] });
  });
});
