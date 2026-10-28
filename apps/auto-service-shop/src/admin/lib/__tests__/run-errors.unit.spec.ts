import { ABANDONED, INTERRUPTED_BY_RESTART } from '../../../lib/run-errors';
import { knownError } from '../run-errors';

describe('knownError', () => {
  it('explains a run the server abandoned or a restart interrupted', () => {
    expect(knownError(ABANDONED)).toBe('publish.knownErrors.abandoned');
    expect(knownError(INTERRUPTED_BY_RESTART)).toBe(
      'publish.knownErrors.interrupted',
    );
  });

  it('leaves an unknown error unexplained', () => {
    expect(knownError('Something else')).toBeNull();
    expect(knownError(null)).toBeNull();
  });
});
