import { describe, it, expect } from 'vitest';
import { isActiveNavPath, navCurrent, swapLocalePath } from './navPath.ts';

describe('isActiveNavPath', () => {
  it('matches the section page itself', () => {
    expect(isActiveNavPath('/ru/services/', '/ru/services/')).toBe(true);
    expect(isActiveNavPath('/ru/contact/', '/ru/contact/')).toBe(true);
  });

  it('lights the section from a detail page below it', () => {
    expect(isActiveNavPath('/sr/works/bmw-x3/', '/sr/works/')).toBe(true);
    expect(isActiveNavPath('/sr/services/diagnostics/', '/sr/services/')).toBe(
      true,
    );
    expect(
      isActiveNavPath(
        '/ru/vehicle-sourcing/de/berlin/',
        '/ru/vehicle-sourcing/',
      ),
    ).toBe(true);
  });

  it('does not match a sibling section', () => {
    expect(isActiveNavPath('/ru/cases/', '/ru/vehicle-sourcing/')).toBe(false);
  });

  it('only matches on a segment boundary, so a shared prefix is not enough', () => {
    expect(isActiveNavPath('/sr/works-archive/', '/sr/works/')).toBe(false);
    expect(
      isActiveNavPath('/ru/vehicle-import-china/', '/ru/vehicle-import/'),
    ).toBe(false);
    expect(
      isActiveNavPath('/ru/vehicle-import/china/', '/ru/vehicle-import/'),
    ).toBe(true);
  });

  it('matches a one-segment target only exactly, so home never swallows the site', () => {
    expect(isActiveNavPath('/ru/', '/ru/')).toBe(true);
    expect(isActiveNavPath('/ru/vehicle-sourcing/', '/ru/')).toBe(false);
    expect(isActiveNavPath('/sr/works/', '/sr/')).toBe(false);
    expect(isActiveNavPath('/sr/contact/', '/')).toBe(false);
  });

  it('stays scoped to one locale', () => {
    expect(isActiveNavPath('/en/contact/', '/sr/contact/')).toBe(false);
    expect(isActiveNavPath('/en/contact/', '/en/contact/')).toBe(true);
    expect(
      isActiveNavPath('/ru/vehicle-sourcing/de/', '/en/vehicle-sourcing/'),
    ).toBe(false);
    expect(
      isActiveNavPath('/de/vehicle-import/eu/de/', '/de/vehicle-import/'),
    ).toBe(true);
  });

  it('treats both trailing-slash forms as the same page', () => {
    expect(isActiveNavPath('/sr/contact', '/sr/contact/')).toBe(true);
    expect(isActiveNavPath('/sr/contact/', '/sr/contact')).toBe(true);
    expect(
      isActiveNavPath('/ru/vehicle-import/eu/de', '/ru/vehicle-import'),
    ).toBe(true);
  });

  it('ignores a query string and a hash on the current URL', () => {
    expect(isActiveNavPath('/sr/shop/?page=2', '/sr/shop/')).toBe(true);
    expect(isActiveNavPath('/sr/shop/#top', '/sr/shop/')).toBe(true);
    expect(isActiveNavPath('/ru/cases?utm_source=x', '/ru/cases/')).toBe(true);
    expect(
      isActiveNavPath('/ru/cases/vehicle-sourcing/?utm_source=x', '/ru/cases/'),
    ).toBe(true);
  });

  it('never marks a link to a page section active', () => {
    expect(isActiveNavPath('/ru/', '/ru/#process')).toBe(false);
    expect(isActiveNavPath('/ru/', '/ru/#faq')).toBe(false);
    expect(isActiveNavPath('/ru/cases/vehicle-import/', '/ru/cases/#top')).toBe(
      false,
    );
  });
});

describe('swapLocalePath', () => {
  it('replaces the locale segment and keeps the rest of the path', () => {
    expect(swapLocalePath('/ru/works/bmw-x5/', 'sr')).toBe('/sr/works/bmw-x5/');
  });

  it('returns the locale root when there is nothing below it', () => {
    expect(swapLocalePath('/ru/', 'en')).toBe('/en/');
  });

  it('adds the trailing slash a source path was missing', () => {
    expect(swapLocalePath('/ru/works', 'en')).toBe('/en/works/');
  });

  it('treats a bare root as having no rest', () => {
    expect(swapLocalePath('/', 'sr')).toBe('/sr/');
  });
});

describe('navCurrent', () => {
  it('marks the link the visitor is standing on as the page', () => {
    expect(navCurrent('/sr/works/', '/sr/works/')).toBe('page');
    expect(navCurrent('/sr/works', '/sr/works/')).toBe('page');
    expect(navCurrent('/sr/works/?utm_source=x', '/sr/works/')).toBe('page');
  });

  it('marks an ancestor section as related, not as the page', () => {
    expect(navCurrent('/sr/works/bmw-x3/', '/sr/works/')).toBe('true');
  });

  it('leaves an unrelated link unmarked', () => {
    expect(navCurrent('/sr/contact/', '/sr/works/')).toBeUndefined();
  });
});
