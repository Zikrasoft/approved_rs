import { describe, it, expect } from 'vitest';
import { getCasesForPage } from './cases';

const mockCases = [
  { id: 'a', data: { country: 'de', service: 'autopodbor', published: true } },
  { id: 'b', data: { country: 'de', service: 'delivery', published: true } },
  { id: 'c', data: { country: 'rs', service: 'autopodbor', published: true } },
  { id: 'd', data: { country: 'de', service: 'autopodbor', published: false } },
] as any[];

describe('getCasesForPage', () => {
  it('filters by country', () => {
    const result = getCasesForPage(mockCases, { country: 'de' });
    expect(result.every(c => c.data.country === 'de')).toBe(true);
    expect(result.length).toBe(2); // published only
  });

  it('filters by service', () => {
    const result = getCasesForPage(mockCases, { service: 'autopodbor' });
    expect(result.every(c => c.data.service === 'autopodbor')).toBe(true);
    expect(result.length).toBe(2); // published only
  });

  it('filters by country and service', () => {
    const result = getCasesForPage(mockCases, { country: 'de', service: 'autopodbor' });
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('a');
  });

  it('excludes unpublished cases', () => {
    const result = getCasesForPage(mockCases, {});
    expect(result.every(c => c.data.published)).toBe(true);
  });

  it('returns all published cases when no filters', () => {
    const result = getCasesForPage(mockCases, {});
    expect(result.length).toBe(3);
  });
});
