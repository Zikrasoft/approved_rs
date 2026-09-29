// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEV_MODE_INLINE, DEV_STORAGE_KEY, applyDevMode } from './devMode';

const visit = (search: string) =>
  window.history.replaceState(null, '', `/sr/shop/${search}`);

const isDev = () => document.documentElement.hasAttribute('data-dev');

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-dev');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each([
  ['the module function', () => applyDevMode()],
  ['the inline head script', () => new Function(DEV_MODE_INLINE)()],
])('%s', (_label, run) => {
  it('turns dev mode on with ?dev=true and remembers it', () => {
    visit('?dev=true');
    run();
    expect(isDev()).toBe(true);
    expect(localStorage.getItem(DEV_STORAGE_KEY)).toBe('1');
  });

  it('keeps dev mode after a reload without the query', () => {
    localStorage.setItem(DEV_STORAGE_KEY, '1');
    visit('');
    run();
    expect(isDev()).toBe(true);
  });

  it('turns it off with ?dev=false and forgets it', () => {
    localStorage.setItem(DEV_STORAGE_KEY, '1');
    visit('?dev=false');
    run();
    expect(isDev()).toBe(false);
    expect(localStorage.getItem(DEV_STORAGE_KEY)).toBeNull();
  });

  it('stays off for a normal visitor', () => {
    visit('');
    run();
    expect(isDev()).toBe(false);
  });

  it('still honours ?dev=true for this page when storage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('private mode');
    });
    visit('?dev=true');
    expect(() => run()).not.toThrow();
    expect(isDev()).toBe(true);
  });

  it('does not crash a normal page when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    visit('');
    expect(() => run()).not.toThrow();
    expect(isDev()).toBe(false);
  });
});
