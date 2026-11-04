// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { localeTagOf } from './localeTag';

afterEach(() => document.documentElement.removeAttribute('lang'));

describe('localeTagOf', () => {
  it('prefers the element tag and falls back to the page language', () => {
    document.documentElement.lang = 'en-RS';
    const element = document.createElement('div');
    expect(localeTagOf(element)).toBe('en-RS');
    element.dataset.localeTag = 'ru-RS';
    expect(localeTagOf(element)).toBe('ru-RS');
  });
});
