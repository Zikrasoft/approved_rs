// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { definePartGallery } from './partGallery';

definePartGallery();

const thumb = (src: string, current = false) =>
  `<a href="${src}" data-thumb data-srcset="${src} 2x" ${current ? 'aria-current="true"' : ''}>x</a>`;

const tap = (link: Element) => {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  link.dispatchEvent(event);
  return event;
};

describe('<part-gallery>', () => {
  it('shows a tapped thumbnail in the main image', () => {
    document.body.innerHTML = `
      <part-gallery>
        <img data-main src="https://img/a.webp" srcset="https://img/a.webp 2x" alt="" />
        ${thumb('https://img/a.webp', true)}${thumb('https://img/b.webp')}
      </part-gallery>`;
    const main = document.querySelector<HTMLImageElement>('[data-main]')!;
    const [first, second] = document.querySelectorAll('a');
    expect(tap(second).defaultPrevented).toBe(true);
    expect([main.src, main.srcset]).toEqual([
      'https://img/b.webp',
      'https://img/b.webp 2x',
    ]);
    expect(first.hasAttribute('aria-current')).toBe(false);
    expect(second.getAttribute('aria-current')).toBe('true');
  });

  it('leaves the thumbnails as plain links without a main image', () => {
    document.body.innerHTML = `<part-gallery>${thumb('https://img/b.webp')}</part-gallery>`;
    expect(tap(document.querySelector('a')!).defaultPrevented).toBe(false);
  });
});
