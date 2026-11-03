import type { ImageMetadata } from 'astro';
import { describe, expect, it } from 'vitest';
import tall from '@/assets/mechanic-wheel-lift-tall.jpg';
import wide from '@/assets/workshop-bay.jpg';
import cover from '@/assets/workshop-facade.jpg';
import { panelPhoto, visitPhoto } from './panelPhoto';

describe('panelPhoto', () => {
  it('asks a wide photo for the width a 3:4 full-height hero column crops away, not the phone banner', async () => {
    expect((await panelPhoto({ image: wide, alt: '' })).sizes).toBe(
      '(min-width: 1224px) calc(532px * 2.37), (min-width: 1024px) calc(calc(46.5vw - 19px) * 2.37), calc(100vw - 2.5rem)',
    );
  });

  it('asks a 4:5 portrait for barely more than the hero column width', async () => {
    expect((await panelPhoto({ image: tall, alt: '' })).sizes).toBe(
      '(min-width: 1224px) calc(532px * 1.07), (min-width: 1024px) calc(calc(46.5vw - 19px) * 1.07), calc(100vw - 2.5rem)',
    );
  });

  it('asks the garage entrance for the half of the visit panel it fills square', async () => {
    const facade = await visitPhoto({ image: cover, alt: '' });

    expect(facade.sizes).toBe(
      '(min-width: 1224px) calc(572px * 1.78), (min-width: 1024px) calc(calc(50vw - 20px) * 1.78), calc(100vw - 2.5rem)',
    );
    expect(facade.srcset).toContain('1280w');
    expect(facade.srcset).not.toContain('1920w');
  });

  it('offers a wide photo at the width a 2x desktop column crops it to, never past the original', async () => {
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
