// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineFilterSheet } from './filterSheet';

window.matchMedia ??= (() => ({
  matches: false,
  addEventListener: () => undefined,
})) as unknown as typeof window.matchMedia;
defineFilterSheet();

const sheet = () => {
  const form = document.createElement('form');
  form.innerHTML = `
    <input type="hidden" name="category" value="batteries" />
    <filter-sheet data-count-url="/api/search-count?locale=ru">
      <input name="min.capacity" value="" />
      <input name="max.capacity" value="80" />
      <input type="checkbox" name="facets" value="brand:varta" checked />
      <button data-filters-submit="Показать" data-filters-count="Показать {count}">Показать 202</button>
    </filter-sheet>
  `;
  document.body.append(form);
  return { form, submit: form.querySelector('button')! };
};

const edit = (form: HTMLFormElement, name: string) =>
  form
    .querySelector(`[name="${name}"]`)!
    .dispatchEvent(new Event('input', { bubbles: true }));

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('the filter sheet', () => {
  it('leaves range bounds the visitor left blank out of the URL', () => {
    const { form } = sheet();

    const formData = new FormData(form);
    form.dispatchEvent(Object.assign(new Event('formdata'), { formData }));
    const sent = [...formData].map(([name, value]) => [name, value]);

    expect(sent).toEqual([
      ['category', 'batteries'],
      ['max.capacity', '80'],
      ['facets', 'brand:varta'],
    ]);
  });

  it('recounts the results while a filter is edited, keeping the last count meanwhile', async () => {
    vi.useFakeTimers();
    const backend = vi.fn().mockResolvedValue(Response.json({ count: 81 }));
    vi.stubGlobal('fetch', backend);
    const { form, submit } = sheet();

    edit(form, 'max.capacity');
    expect(submit.textContent).toBe('Показать 202');
    expect(submit.getAttribute('aria-busy')).toBe('true');
    await vi.runAllTimersAsync();

    expect(backend).toHaveBeenCalledWith(
      '/api/search-count?locale=ru&category=batteries&max.capacity=80&facets=brand%3Avarta',
      expect.anything(),
    );
    expect(submit.textContent).toBe('Показать 81');
    expect(submit.hasAttribute('aria-busy')).toBe(false);
  });

  it('falls back to the plain label when the count fails', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    const { form, submit } = sheet();

    edit(form, 'facets');
    await vi.runAllTimersAsync();

    expect(submit.textContent).toBe('Показать');
    expect(submit.hasAttribute('aria-busy')).toBe(false);
  });
});
