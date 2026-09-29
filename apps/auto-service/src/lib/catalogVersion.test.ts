import { describe, expect, it, vi } from 'vitest';
import { catalogVersionText } from './catalogVersion';

describe('catalogVersionText', () => {
  it('answers disabled when the shop is off, without asking Medusa', async () => {
    const version = vi.fn();

    expect(await catalogVersionText('off', version)).toBe('disabled\n');
    expect(version).not.toHaveBeenCalled();
  });

  it.each(['preview', 'live'] as const)(
    'bakes the store version in %s',
    async (status) => {
      expect(
        await catalogVersionText(
          status,
          async () => '2026-09-29T02:20:01.701Z',
        ),
      ).toBe('2026-09-29T02:20:01.701Z\n');
    },
  );
});
