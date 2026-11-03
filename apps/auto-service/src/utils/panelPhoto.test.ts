import type { ImageMetadata } from 'astro';
import { describe, expect, it } from 'vitest';
import tall from '@/assets/mechanic-wheel-lift-tall.jpg';
import wide from '@/assets/workshop-bay.jpg';
import cover from '@/assets/workshop-facade.jpg';
import { panelPhoto } from './panelPhoto';

describe('panelPhoto', () => {
  it('asks a wide photo for the width its 4:3 desktop inset crops away, not the phone banner', async () => {
    expect((await panelPhoto({ image: wide, alt: '' })).sizes).toBe(
      '(min-width: 1224px) calc(508px * 1.33), (min-width: 1024px) calc(calc(46.5vw - 43px) * 1.33), calc(100vw - 2.5rem)',
    );
  });

  it('asks a portrait photo for its slot width', async () => {
    expect((await panelPhoto({ image: tall, alt: '' })).sizes).toBe(
      '(min-width: 1224px) 508px, (min-width: 1024px) calc(46.5vw - 43px), calc(100vw - 2.5rem)',
    );
  });

  it('offers a wide photo at the width a 2x desktop inset crops it to, never past the original', async () => {
    const widest = async (image: ImageMetadata) =>
      Math.max(
        ...(await panelPhoto({ image, alt: '' })).srcset
          .split(', ')
          .map((candidate) => Number(candidate.split(' ')[1]!.slice(0, -1))),
      );

    expect(await widest(wide)).toBe(1920);
    expect(await widest(cover)).toBe(1280);
  });

  it('keeps the alt text it was given', async () => {
    expect((await panelPhoto({ image: wide, alt: 'Цех CarLab' })).alt).toBe(
      'Цех CarLab',
    );
  });
});
