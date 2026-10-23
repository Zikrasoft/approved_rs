// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { definePartImage } from './partImage';

const mount = (loaded: { complete: boolean; naturalWidth: number }) => {
  definePartImage();
  const holder = document.createElement('part-image');
  const image = document.createElement('img');
  image.setAttribute('src', '/missing.webp');
  Object.defineProperties(image, {
    complete: { value: loaded.complete },
    naturalWidth: { value: loaded.naturalWidth },
  });
  holder.append(image);
  document.body.append(holder);
  return { holder, image };
};

describe('the part image', () => {
  it('shows the placeholder for an image that failed before the script ran', () => {
    const { holder } = mount({ complete: true, naturalWidth: 0 });

    expect(holder.hasAttribute('data-broken')).toBe(true);
  });

  it('keeps an image that loaded or is still loading', () => {
    const loaded = mount({ complete: true, naturalWidth: 80 }).holder;
    const pending = mount({ complete: false, naturalWidth: 0 }).holder;

    expect(loaded.hasAttribute('data-broken')).toBe(false);
    expect(pending.hasAttribute('data-broken')).toBe(false);
  });

  it('shows the placeholder when the file 404s and drops it once another source loads', () => {
    const { holder, image } = mount({ complete: false, naturalWidth: 0 });

    image.dispatchEvent(new Event('error'));
    const broken = holder.hasAttribute('data-broken');
    image.dispatchEvent(new Event('load'));

    expect(broken).toBe(true);
    expect(holder.hasAttribute('data-broken')).toBe(false);
  });
});
