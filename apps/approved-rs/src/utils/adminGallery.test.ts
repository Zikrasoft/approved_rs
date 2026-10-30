import { describe, it, expect } from 'vitest';
import {
  galleryTargetSchema,
  casePhotosPageSchema,
  sanitizeFilename,
  dedupeFilename,
  appendGalleryEntries,
} from './adminGallery';

describe('galleryTargetSchema', () => {
  const slugPasses = (slug: string) =>
    galleryTargetSchema.safeParse({ dir: 'src/content/cases', slug }).success;

  it('accepts lowercase-digit-dash slugs, rejects anything with a path separator or unsafe char', () => {
    expect(slugPasses('bmw-320')).toBe(true);
    expect(slugPasses('../etc')).toBe(false);
    expect(slugPasses('bmw/320')).toBe(false);
    expect(slugPasses('BMW-320')).toBe(false);
  });

  it('accepts only a known case collection dir', () => {
    expect(
      galleryTargetSchema.safeParse({ dir: 'src/content', slug: 'bmw' })
        .success,
    ).toBe(false);
  });
});

describe('casePhotosPageSchema', () => {
  it('reads a photo count and the one known error, dropping anything else', () => {
    expect(
      casePhotosPageSchema.parse({ ok: '3', error: 'no-files', slug: 'bmw' }),
    ).toEqual({ dir: '', slug: 'bmw', ok: 3, error: 'no-files' });
    expect(casePhotosPageSchema.parse({ ok: '<b>', error: 'other' })).toEqual({
      dir: '',
      slug: '',
      ok: undefined,
      error: undefined,
    });
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
