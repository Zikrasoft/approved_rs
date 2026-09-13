import { describe, expect, it } from 'vitest';
import { navCurrent } from './navState';
import { PathBuilder } from './paths';

describe('navCurrent', () => {
  it('marks the section page itself as the current page', () => {
    expect(
      navCurrent('/ru/vehicle-sourcing/', PathBuilder.vehicleSourcingHub('ru')),
    ).toBe('page');
    expect(navCurrent('/ru/vehicle-import', '/ru/vehicle-import/')).toBe(
      'page',
    );
    expect(navCurrent('/ru/cases/?utm_source=x', '/ru/cases/')).toBe('page');
  });

  it('marks an ancestor section as current but not as the page', () => {
    expect(
      navCurrent(
        '/ru/vehicle-sourcing/de/berlin/',
        PathBuilder.vehicleSourcingHub('ru'),
      ),
    ).toBe('true');
    expect(navCurrent('/ru/cases/bmw-x5-2019/', '/ru/cases/')).toBe('true');
  });

  it('leaves an unrelated link uncurrent', () => {
    expect(navCurrent('/ru/cases/', '/ru/vehicle-sourcing/')).toBeUndefined();
    expect(navCurrent('/ru/vehicle-sourcing/', '/ru/')).toBeUndefined();
    expect(
      navCurrent('/ru/vehicle-import-china/', '/ru/vehicle-import/'),
    ).toBeUndefined();
  });
});
