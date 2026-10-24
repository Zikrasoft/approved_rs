// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { defineFilterSheet } from './filterSheet';

describe('the filter sheet', () => {
  it('leaves range bounds the visitor left blank out of the URL', () => {
    window.matchMedia ??= (() => ({
      matches: false,
      addEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
    defineFilterSheet();
    const form = document.createElement('form');
    form.innerHTML = `
      <input type="hidden" name="category" value="batteries" />
      <filter-sheet>
        <input name="min.capacity" value="" />
        <input name="max.capacity" value="80" />
        <input type="checkbox" name="facets" value="brand:varta" checked />
      </filter-sheet>
    `;
    document.body.append(form);

    const formData = new FormData(form);
    form.dispatchEvent(Object.assign(new Event('formdata'), { formData }));
    const sent = [...formData].map(([name, value]) => [name, value]);

    expect(sent).toEqual([
      ['category', 'batteries'],
      ['max.capacity', '80'],
      ['facets', 'brand:varta'],
    ]);
  });
});
