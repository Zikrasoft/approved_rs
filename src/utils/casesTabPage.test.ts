import { describe, it, expect, vi } from 'vitest';
import { SITE_URL, SITE_NAME } from '@/utils/constants';
import type { CaseCardProps } from '@/components/CaseCard.astro';

vi.mock('@/utils/casesQueries', () => ({
  getCasesTabCounts: vi.fn().mockResolvedValue({
    'vehicle-sourcing': 3,
    'vehicle-buyback': 0,
    'vehicle-inspection': 0,
    'vehicle-import': 0,
    'auto-service': 0,
    detailing: 0,
  }),
}));

const { buildCasesTabPageData } = await import('./casesTabPage');
const { getCasesTabCounts } = await import('@/utils/casesQueries');

describe('buildCasesTabPageData', () => {
  it('builds meta from the given content key and canonical path', async () => {
    const { meta } = await buildCasesTabPageData(
      'ru',
      'casesVehicleSourcing',
      '/ru/cases/vehicle-sourcing/',
      async () => [],
    );
    expect(meta.canonical).toBe(`${SITE_URL}/ru/cases/vehicle-sourcing/`);
    expect(meta.title.endsWith(SITE_NAME)).toBe(true);
  });

  it('fetches items and tab counts in parallel, returning both', async () => {
    const items: CaseCardProps[] = [
      { href: '/x', imageAlt: 'x', car: 'x', badges: [] },
    ];
    const result = await buildCasesTabPageData(
      'ru',
      'casesAutoService',
      '/ru/auto-service-belgrade/',
      async () => items,
    );
    expect(result.items).toBe(items);
    expect(result.counts).toEqual(await getCasesTabCounts());
  });
});
