import { describe, expect, it } from 'vitest';
import { shopPreview } from './shopPreview';

const browser = () => {
  let stored = '';
  return {
    get cookie() {
      return stored;
    },
    set cookie(next: string) {
      const [pair] = next.split(';');
      stored = pair.endsWith('=') ? '' : pair;
    },
  };
};

const blocked = {
  get cookie() {
    return '';
  },
  set cookie(_next: string) {},
};

describe('shopPreview', () => {
  it('stays off for a visitor who never opened a page with ?dev=1', () => {
    expect(shopPreview('', browser())).toBe(false);
  });

  it('remembers ?dev=1 on later pages and forgets it after ?dev=0', () => {
    const jar = browser();

    expect(shopPreview('?q=filter&dev=1', jar)).toBe(true);
    expect(shopPreview('', jar)).toBe(true);
    expect(jar.cookie).toBe('carlab_shop_preview=1');
    expect(shopPreview('?dev=0', jar)).toBe(false);
    expect(shopPreview('', jar)).toBe(false);
  });

  it('follows the address alone when cookies are blocked', () => {
    expect(shopPreview('?dev=1', blocked)).toBe(true);
    expect(shopPreview('', blocked)).toBe(false);
  });

  it('ignores the old ?df=1 address', () => {
    expect(shopPreview('?df=1', browser())).toBe(false);
  });
});
