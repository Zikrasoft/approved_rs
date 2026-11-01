import { describe, expect, it } from 'vitest';

const components = import.meta.glob<string>('./*.astro', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('the modal sheet', () => {
  it('is the one place a modal form keeps its submit bar in view', () => {
    const shells = Object.entries(components)
      .filter(([, source]) => source.includes('[&_.lead-submit]'))
      .map(([path]) => path);
    expect(shells.sort()).toEqual(['./ModalSheet.astro']);
  });

  it('closes every dialog through the one close button', () => {
    const closers = Object.entries(components)
      .filter(([, source]) => /<button\s[^>]*data-modal-close/.test(source))
      .map(([path]) => path);
    expect(closers).toEqual(['./SheetClose.astro']);
  });
});
