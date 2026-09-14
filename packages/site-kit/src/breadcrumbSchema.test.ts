import { describe, it, expect } from 'vitest';
import { breadcrumbListSchema } from './breadcrumbSchema.ts';

const SITE = 'https://example.com';

describe('breadcrumbListSchema', () => {
  it('numbers the trail from one', () => {
    const schema = breadcrumbListSchema(SITE, [
      { label: 'Главная', href: '/ru/' },
      { label: 'Услуги', href: '/ru/services/' },
      { label: 'Полировка' },
    ]);
    expect(schema.itemListElement.map((e) => e.position)).toEqual([1, 2, 3]);
    expect(schema['@type']).toBe('BreadcrumbList');
  });

  it('absolutises every linked step against the site url', () => {
    const schema = breadcrumbListSchema(SITE, [
      { label: 'Главная', href: '/ru/' },
      { label: 'Услуги', href: '/ru/services/' },
      { label: 'Полировка' },
    ]);
    expect(schema.itemListElement[0]).toMatchObject({
      item: 'https://example.com/ru/',
    });
    expect(schema.itemListElement[1]).toMatchObject({
      item: 'https://example.com/ru/services/',
    });
  });

  it('leaves the last crumb unlinked even when it carries an href', () => {
    const schema = breadcrumbListSchema(SITE, [
      { label: 'Главная', href: '/ru/' },
      { label: 'Услуги', href: '/ru/services/' },
    ]);
    expect(schema.itemListElement[1]).not.toHaveProperty('item');
    expect(schema.itemListElement[1]!.name).toBe('Услуги');
  });

  it('leaves a middle crumb without an href unlinked', () => {
    const schema = breadcrumbListSchema(SITE, [
      { label: 'Главная', href: '/ru/' },
      { label: 'Германия' },
      { label: 'Берлин' },
    ]);
    expect(schema.itemListElement[1]).not.toHaveProperty('item');
  });

  it('accepts a single-crumb trail', () => {
    const schema = breadcrumbListSchema(SITE, [
      { label: 'Главная', href: '/ru/' },
    ]);
    expect(schema.itemListElement).toHaveLength(1);
    expect(schema.itemListElement[0]).not.toHaveProperty('item');
  });

  it('accepts an empty trail', () => {
    expect(breadcrumbListSchema(SITE, []).itemListElement).toEqual([]);
  });
});
