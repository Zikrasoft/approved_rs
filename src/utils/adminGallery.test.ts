import { describe, it, expect } from 'vitest';
import {
  isValidSlug,
  sanitizeFilename,
  dedupeFilename,
  appendGalleryEntries,
} from './adminGallery';

describe('isValidSlug', () => {
  it('accepts lowercase-digit-dash slugs, rejects anything with a path separator or unsafe char', () => {
    expect(isValidSlug('bmw-320')).toBe(true);
    expect(isValidSlug('../etc')).toBe(false);
    expect(isValidSlug('bmw/320')).toBe(false);
    expect(isValidSlug('BMW-320')).toBe(false);
  });
});

describe('sanitizeFilename', () => {
  it('strips directory components and keeps the extension', () => {
    expect(sanitizeFilename('../../etc/passwd.jpg')).toBe('passwd.jpg');
    expect(sanitizeFilename('Мой Фото №1.PNG')).toBe('1.png');
  });

  it('collapses unsafe characters and falls back when the name is empty', () => {
    expect(sanitizeFilename('IMG 0001 (2).jpg')).toBe('img-0001-2.jpg');
    expect(sanitizeFilename('.jpg')).toBe('photo.jpg');
  });
});

describe('dedupeFilename', () => {
  it('returns the name unchanged when free, otherwise the first free -N suffix', () => {
    const taken = new Set(['a.jpg', 'a-2.jpg']);
    expect(dedupeFilename('b.jpg', taken)).toBe('b.jpg');
    expect(dedupeFilename('a.jpg', taken)).toBe('a-3.jpg');
  });
});

describe('appendGalleryEntries', () => {
  it('inserts a new gallery: block right after image: when none exists', () => {
    const raw = [
      'title: BMW',
      'image: ./image.jpg',
      'date: 2026-01-01',
      '',
    ].join('\n');
    const result = appendGalleryEntries(raw, [
      'gallery/0.jpg',
      'gallery/1.jpg',
    ]);
    expect(result).toBe(
      [
        'title: BMW',
        'image: ./image.jpg',
        'gallery:',
        '  - gallery/0.jpg',
        '  - gallery/1.jpg',
        'date: 2026-01-01',
        '',
      ].join('\n'),
    );
  });

  it('appends after existing gallery entries without disturbing later fields', () => {
    const raw = [
      'image: ./image.jpg',
      'gallery:',
      '  - gallery/0.jpg',
      'date: 2026-01-01',
    ].join('\n');
    const result = appendGalleryEntries(raw, ['gallery/1.jpg']);
    expect(result).toBe(
      [
        'image: ./image.jpg',
        'gallery:',
        '  - gallery/0.jpg',
        '  - gallery/1.jpg',
        'date: 2026-01-01',
      ].join('\n'),
    );
  });

  it('throws when there is no image: line (not a case file)', () => {
    expect(() => appendGalleryEntries('title: x', ['gallery/0.jpg'])).toThrow();
  });
});
