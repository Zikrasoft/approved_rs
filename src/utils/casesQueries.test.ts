import { describe, it, expect, vi } from 'vitest';

// getPublishedCases pulls in getCollection from the virtual 'astro:content'
// module — only resolvable inside Astro's own build pipeline, not in this
// project's plain-Node vitest config. Mocked here (standard vitest technique
// for virtual modules) rather than pulling Astro's Vite plugin into the test
// config for one file.
const cases = [
  { data: { published: true, service: 'vehicle-sourcing', date: new Date('2024-01-01') } },
  { data: { published: true, service: 'vehicle-buyback', date: new Date('2024-03-01') } },
  { data: { published: true, service: 'vehicle-inspection', date: new Date('2024-02-01') } },
  { data: { published: true, service: 'vehicle-import', date: new Date('2024-04-01') } },
  { data: { published: false, service: 'vehicle-sourcing', date: new Date('2024-05-01') } },
];

vi.mock('astro:content', () => ({
  getCollection: vi.fn((_name: string, filter: (c: (typeof cases)[number]) => boolean) => Promise.resolve(cases.filter(filter))),
}));

const { getPublishedCases } = await import('./casesQueries');

describe('getPublishedCases', () => {
  it('excludes vehicle-import and unpublished cases', async () => {
    const result = await getPublishedCases();
    expect(result.map(c => c.data.service)).toEqual(['vehicle-buyback', 'vehicle-inspection', 'vehicle-sourcing']);
  });

  it('sorts by date descending', async () => {
    const result = await getPublishedCases();
    expect(result[0].data.service).toBe('vehicle-buyback');
    expect(result.at(-1)!.data.service).toBe('vehicle-sourcing');
  });
});
