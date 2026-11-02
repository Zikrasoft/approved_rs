import { describe, expect, it } from 'vitest';
import tall from '@/assets/hero-mechanic.jpg';
import wide from '@/assets/hero-mechanic-wide.jpg';
import WorkGallery from './WorkGallery.astro';
import { render } from './renderAstro';

const gallery = (images: ImageMetadata[]) =>
  render(WorkGallery, {
    path: '/ru/works/bmw-x3/',
    props: { images, alt: 'BMW X3' },
  });

describe('WorkGallery', () => {
  it('opens every photo in the lightbox at no more than 1280px wide', async () => {
    const items = [
      ...(await gallery([wide, tall])).querySelectorAll<HTMLElement>(
        '[data-lightbox-item]',
      ),
    ];

    expect(items.map((item) => item.dataset.alt)).toEqual([
      'BMW X3, 1',
      'BMW X3, 2',
    ]);
    expect(items.every((item) => item.dataset.src?.includes('w=1280'))).toBe(
      true,
    );
  });

  it('keeps each photo uncropped in a masonry column', async () => {
    const image = (await gallery([tall])).querySelector('img')!;

    expect(image.classList.contains('h-auto')).toBe(true);
    expect(image.className).not.toContain('aspect-');
  });

  it('goes to three columns on a wide screen only when there are photos to fill them', async () => {
    const columns = async (images: ImageMetadata[]) =>
      (await gallery(images)).querySelector('gallery-lightbox')!.classList;

    expect((await columns([wide, tall])).contains('lg:columns-3')).toBe(false);
    expect((await columns([wide, tall])).contains('lg:max-w-3xl')).toBe(true);
    expect((await columns([wide, tall, wide])).contains('lg:columns-3')).toBe(
      true,
    );
  });

  it('shows a single photo at a readable width instead of half a two-column grid', async () => {
    const root = await gallery([tall]);
    const columns = root.querySelector('gallery-lightbox')!.classList;

    expect(columns.contains('columns-2')).toBe(false);
    expect(columns.contains('max-w-sm')).toBe(true);
    expect(root.querySelector('img')?.getAttribute('sizes')).toBe(
      '(min-width: 640px) 384px, calc(100vw - 2.5rem)',
    );
    expect(
      (await gallery([wide, tall]))
        .querySelector('gallery-lightbox')!
        .classList.contains('columns-2'),
    ).toBe(true);
  });

  it('offers previous and next only when there is another photo to show', async () => {
    const arrows = async (images: ImageMetadata[]) =>
      (await gallery(images)).querySelectorAll('[data-prev], [data-next]')
        .length;

    expect(await arrows([wide])).toBe(0);
    expect(await arrows([wide, tall])).toBe(2);
  });

  it('closes from a labelled button inside the dialog', async () => {
    const close = (await gallery([wide])).querySelector(
      'dialog [data-modal-close]',
    );

    expect(close?.getAttribute('aria-label')).toBe('Закрыть');
  });
});
