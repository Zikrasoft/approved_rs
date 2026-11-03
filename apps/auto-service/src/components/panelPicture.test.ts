import { describe, expect, it } from 'vitest';
import PanelPicture from './PanelPicture.astro';
import { render } from './renderAstro';

const photo = {
  src: '/bay.webp',
  srcset: '/bay-480.webp 480w, /bay-1080.webp 1080w',
  sizes: 'calc(100vw - 2.5rem)',
  width: 1920,
  height: 1080,
  alt: 'Цех CarLab',
};
const picture = async (props: Record<string, unknown> = {}) =>
  (
    await render(PanelPicture, { path: '/ru/', props: { photo, ...props } })
  ).querySelector('picture')!;

describe('PanelPicture', () => {
  it('fills the right column of the panel to its full height, edge to edge', async () => {
    const root = await picture();
    const image = root.querySelector('img')!;

    expect([...root.classList]).toEqual(
      expect.arrayContaining(['relative', 'lg:col-start-2', 'lg:row-start-1']),
    );
    expect(root.className).not.toMatch(/(^|\s)(lg:)?p[xytrbl]?-/);
    expect([...image.classList]).toEqual(
      expect.arrayContaining([
        'w-full',
        'object-cover',
        'lg:absolute',
        'lg:inset-0',
        'lg:h-full',
        'lg:aspect-auto',
      ]),
    );
    expect(image.className).not.toContain('rounded');
  });

  it('spans the phone screen as a wide banner on top', async () => {
    const image = (await picture()).querySelector('img')!;

    expect(image.classList.contains('aspect-[2/1]')).toBe(true);
    expect(image.classList.contains('sm:aspect-[5/2]')).toBe(true);
  });

  it('serves the photo it is given', async () => {
    const image = (await picture()).querySelector('img')!;

    expect(image.getAttribute('src')).toBe(photo.src);
    expect(image.getAttribute('srcset')).toBe(photo.srcset);
    expect(image.getAttribute('sizes')).toBe(photo.sizes);
    expect(image.getAttribute('width')).toBe('1920');
    expect(image.getAttribute('height')).toBe('1080');
    expect(image.getAttribute('alt')).toBe('Цех CarLab');
  });

  it('loads lazily unless it is the first screen', async () => {
    const lazy = (await picture()).querySelector('img')!;
    const first = (await picture({ priority: true })).querySelector('img')!;

    expect(lazy.getAttribute('loading')).toBe('lazy');
    expect(lazy.hasAttribute('fetchpriority')).toBe(false);
    expect(first.getAttribute('loading')).toBe('eager');
    expect(first.getAttribute('fetchpriority')).toBe('high');
  });

  it('swaps in a wide-screen crop only when one is given', async () => {
    const lg = {
      media: '(min-width: 1024px)',
      srcset: '/tall-560.webp 560w',
      sizes: '532px',
    };
    const source = (await picture({ lg })).querySelector('source')!;

    expect((await picture()).querySelector('source')).toBeNull();
    expect(source.getAttribute('media')).toBe(lg.media);
    expect(source.getAttribute('srcset')).toBe(lg.srcset);
    expect(source.getAttribute('sizes')).toBe(lg.sizes);
  });

  it('takes the corner rounding and focal point from the page', async () => {
    const root = await picture({
      class: 'rounded-t-block',
      imgClass: 'lg:object-[50%_45%]',
    });

    expect(root.classList.contains('rounded-t-block')).toBe(true);
    expect(
      root.querySelector('img')!.classList.contains('lg:object-[50%_45%]'),
    ).toBe(true);
  });
});
