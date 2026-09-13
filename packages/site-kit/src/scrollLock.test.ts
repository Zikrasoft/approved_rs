// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { lockScroll, unlockScroll } from './scrollLock.ts';

const root = () => document.documentElement;

describe('scrollLock', () => {
  beforeEach(() => {
    root().style.overflow = '';
    root().style.overscrollBehavior = '';
  });

  it('freezes the page and restores it again', () => {
    lockScroll();
    expect(root().style.overflow).toBe('hidden');
    expect(root().style.overscrollBehavior).toBe('none');

    unlockScroll();
    expect(root().style.overflow).toBe('');
    expect(root().style.overscrollBehavior).toBe('');
  });

  it('keeps the page frozen until the last holder lets go', () => {
    lockScroll();
    lockScroll();

    unlockScroll();
    expect(root().style.overflow).toBe('hidden');

    unlockScroll();
    expect(root().style.overflow).toBe('');
  });

  it('puts back whatever the page already had, not a blank value', () => {
    root().style.overflow = 'clip';
    root().style.overscrollBehavior = 'contain';

    lockScroll();
    expect(root().style.overflow).toBe('hidden');

    unlockScroll();
    expect(root().style.overflow).toBe('clip');
    expect(root().style.overscrollBehavior).toBe('contain');
  });

  it('ignores an unlock nobody asked for instead of going negative', () => {
    unlockScroll();
    lockScroll();
    expect(root().style.overflow).toBe('hidden');

    unlockScroll();
    expect(root().style.overflow).toBe('');
  });
});
