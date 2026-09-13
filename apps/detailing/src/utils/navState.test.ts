import { describe, it, expect } from 'vitest';
import { navCurrent } from './navState';

describe('navCurrent', () => {
  it('reports the page itself, whatever the trailing slash or query', () => {
    expect(navCurrent('/ru/contact/', '/ru/contact/')).toBe('page');
    expect(navCurrent('/sr/works', '/sr/works/')).toBe('page');
    expect(navCurrent('/sr/works/?page=2', '/sr/works/')).toBe('page');
  });

  it('reports a section containing the current page', () => {
    expect(navCurrent('/sr/works/bmw-x5/', '/sr/works/')).toBe('true');
  });

  it('reports nothing for an unrelated link', () => {
    expect(navCurrent('/ru/works/', '/ru/')).toBeUndefined();
    expect(navCurrent('/ru/', '/ru/#process')).toBeUndefined();
  });
});
