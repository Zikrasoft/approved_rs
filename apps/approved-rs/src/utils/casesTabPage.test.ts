import { describe, it, expect, vi } from 'vitest';
import { SITE_NAME } from '@/utils/constants';
import type { CaseCardProps } from '@/components/CaseCard.astro';

vi.mock('@/utils/casesQueries', () => ({
  getCasesTabCounts: vi.fn().mockResolvedValue({
    'vehicle-sourcing': 3,
    'vehicle-buyback': 0,
    'vehicle-inspection': 0,
    'vehicle-import': 0,
  }),
}));

const { buildCasesTabPageData } = await import('./casesTabPage');
const { getCasesTabCounts } = await import('@/utils/casesQueries');

describe('buildCasesTabPageData', () => {
  it('builds meta from the given content key', async () => {
    const { meta } = await buildCasesTabPageData(
      'ru',
      'casesVehicleSourcing',
      async () => [],
    );
    expect(meta.title.endsWith(SITE_NAME)).toBe(true);
  });

  it('fetches items and tab counts in parallel, returning both', async () => {
    const items: CaseCardProps[] = [
      { href: '/x', imageAlt: 'x', car: 'x', badges: [] },
    ];
    const result = await buildCasesTabPageData(
      'ru',
      'casesVehicleSourcing',
      async () => items,
    );
    expect(result.items).toBe(items);
    expect(result.counts).toEqual(await getCasesTabCounts());
  });
});
