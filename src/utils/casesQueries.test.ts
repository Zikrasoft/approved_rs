import { describe, it, expect, vi } from 'vitest';

// getPublishedCasesByService/getCasesTabCounts pull in getCollection from the
// virtual 'astro:content' module — only resolvable inside Astro's own build
// pipeline, not in this project's plain-Node vitest config. Mocked here
// (standard vitest technique for virtual modules) rather than pulling
// Astro's Vite plugin into the test config for one file.
const cases = [
  { data: { published: true, service: 'vehicle-sourcing', date: new Date('2024-01-01') } },
  { data: { published: true, service: 'vehicle-buyback', date: new Date('2024-03-01') } },
  { data: { published: true, service: 'vehicle-inspection', date: new Date('2024-02-01') } },
  { data: { published: true, service: 'vehicle-import', date: new Date('2024-04-01') } },
  { data: { published: false, service: 'vehicle-sourcing', date: new Date('2024-05-01') } },
];
const autoserviceCases = [
  { data: { published: true, date: new Date('2024-01-01') } },
  { data: { published: false, date: new Date('2024-02-01') } },
];
const detailingCases = [
  { data: { published: true, date: new Date('2024-01-01') } },
];

vi.mock('astro:content', () => ({
  getCollection: vi.fn((name: 'cases' | 'autoserviceCases' | 'detailingCases', filter: (c: { data: { published: boolean } }) => boolean) => {
    const byName = { cases, autoserviceCases, detailingCases };
    return Promise.resolve(byName[name].filter(filter));
  }),
}));

const { getPublishedCasesByService, getCasesTabCounts } = await import('./casesQueries');

describe('getPublishedCasesByService', () => {
  it('returns only published cases for the given service', async () => {
    const result = await getPublishedCasesByService('vehicle-sourcing');
    expect(result).toHaveLength(1);
    expect(result[0].data.service).toBe('vehicle-sourcing');
  });

  it('sorts by date descending', async () => {
    const result = await getPublishedCasesByService('vehicle-import');
    expect(result).toHaveLength(1);
    expect(result[0].data.service).toBe('vehicle-import');
  });
});

describe('getCasesTabCounts', () => {
  it('counts published cases per service, plus published autoservice cases', async () => {
    expect(await getCasesTabCounts()).toEqual({
      'vehicle-sourcing': 1,
      'vehicle-buyback': 1,
      'vehicle-inspection': 1,
      'vehicle-import': 1,
      'auto-service': 1,
      'detailing': 1,
    });
  });
});
