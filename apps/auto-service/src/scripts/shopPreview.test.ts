import { describe, expect, it } from 'vitest';
import { previewHeaders, shopPreview } from './shopPreview';

const memory = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
};

const blocked = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

describe('shopPreview', () => {
  it('stays off for a visitor who never opened a page with ?df=1', () => {
    expect(shopPreview('', memory())).toBe(false);
    expect(previewHeaders('', memory())).toEqual({});
  });

  it('remembers ?df=1 on later pages and forgets it after ?df=0', () => {
    const storage = memory();

    expect(shopPreview('?q=filter&df=1', storage)).toBe(true);
    expect(shopPreview('', storage)).toBe(true);
    expect(previewHeaders('', storage)).toEqual({ 'x-shop-preview': '1' });
    expect(shopPreview('?df=0', storage)).toBe(false);
    expect(shopPreview('', storage)).toBe(false);
  });

  it('follows the address alone when storage is blocked', () => {
    expect(shopPreview('?df=1', blocked)).toBe(true);
    expect(shopPreview('', blocked)).toBe(false);
  });
});
