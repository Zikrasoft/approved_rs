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
      <dialog></dialog>
      <span data-filters-live></span>
      <fieldset data-facet-key="capacity">
        <input type="number" min="0" name="min.capacity" value="" />
        <input type="number" min="0" name="max.capacity" value="80" />
      </fieldset>
      <fieldset data-facet-key="brand">
        <label><input type="checkbox" name="facets" value="brand:varta" checked /><span data-facet-count>3</span></label>
        <label><input type="checkbox" name="facets" value="brand:bosch" /><span data-facet-count>2</span></label>
      </fieldset>
      <fieldset data-facet-key="polarity">
        <label><input type="checkbox" name="facets" value="polarity:direct" /><span data-facet-count>1</span></label>
      </fieldset>
      <button data-filters-submit="Показать" data-filters-count="Показать {count}" data-filters-none="Подберем вручную" data-filters-inquiry="/ru/parts/search/#inquiry">Показать 202</button>
    </filter-sheet>
  `;
  document.body.append(form);
  return { form, submit: form.querySelector('button')! };
};

const input = (form: HTMLFormElement, name: string, value = '') =>
  form.querySelector<HTMLInputElement>(
    `[name="${name}"]${value ? `[value="${value}"]` : ''}`,
  )!;

const counted = (root: ParentNode, value: string) =>
  root
    .querySelector(`[value="${value}"]`)!
    .closest('label')!
    .querySelector('[data-facet-count]')!.textContent;

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

  it('recounts the results while a filter is edited, dropping the stale count meanwhile', async () => {
    vi.useFakeTimers();
    const backend = vi.fn().mockResolvedValue(Response.json({ count: 81 }));
    vi.stubGlobal('fetch', backend);
    const { form, submit } = sheet();

    edit(form, 'max.capacity');
    expect(submit.textContent).toBe('Показать');
    expect(submit.getAttribute('aria-busy')).toBe('true');
    await vi.runAllTimersAsync();

    expect(backend).toHaveBeenCalledWith(
      '/api/search-count?locale=ru&category=batteries&max.capacity=80&facets=brand%3Avarta',
      expect.anything(),
    );
    expect(submit.textContent).toBe('Показать 81');
    expect(submit.hasAttribute('aria-busy')).toBe(false);
  });

  it('keeps the plain label and asks for no count when the button has no count label', async () => {
    vi.useFakeTimers();
    const backend = vi.fn();
    vi.stubGlobal('fetch', backend);
    const { form, submit } = sheet();
    submit.removeAttribute('data-filters-count');

    edit(form, 'max.capacity');
    await vi.runAllTimersAsync();

    expect(submit.textContent).toBe('Показать');
    expect(submit.hasAttribute('aria-busy')).toBe(false);
    expect(backend).not.toHaveBeenCalled();
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

  it('updates each value count and disables the values that would find nothing', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          count: 3,
          facets: { brand: { varta: 3, bosch: 1 }, polarity: {} },
        }),
      ),
    );
    const { form } = sheet();
    input(form, 'facets', 'polarity:direct').checked = false;

    edit(form, 'facets');
    await vi.runAllTimersAsync();

    expect(counted(form, 'brand:bosch')).toBe('1');
    expect(input(form, 'facets', 'brand:bosch').disabled).toBe(false);
    expect(counted(form, 'polarity:direct')).toBe('0');
    expect(input(form, 'facets', 'polarity:direct').disabled).toBe(true);
  });

  const fieldset = (form: HTMLFormElement, key: string) =>
    form.querySelector<HTMLFieldSetElement>(`[data-facet-key="${key}"]`)!;

  it('keeps a ticked value enabled even when it counts zero, and hides the facets the answer omits, as the applied page would', async () => {
    vi.useFakeTimers();
    const backend = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ count: 0, facets: { brand: {} } }))
      .mockResolvedValueOnce(
        Response.json({ count: 3, facets: { brand: {}, polarity: {} } }),
      );
    vi.stubGlobal('fetch', backend);
    const { form } = sheet();

    edit(form, 'facets');
    await vi.runAllTimersAsync();

    expect(input(form, 'facets', 'brand:varta').disabled).toBe(false);
    expect(counted(form, 'brand:varta')).toBe('0');
    expect(fieldset(form, 'brand').hidden).toBe(false);
    expect(fieldset(form, 'polarity').hidden).toBe(true);
    expect(fieldset(form, 'capacity').hidden).toBe(false);

    edit(form, 'facets');
    await vi.runAllTimersAsync();
    expect(fieldset(form, 'polarity').hidden).toBe(false);
  });

  it('keeps an omitted facet the visitor has a value in', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ count: 2, facets: {} })),
    );
    const { form } = sheet();
    input(form, 'max.capacity').value = '';
    input(form, 'min.capacity').value = '70';
    input(form, 'facets', 'brand:varta').checked = false;
    input(form, 'facets', 'polarity:direct').checked = true;

    edit(form, 'facets');
    await vi.runAllTimersAsync();

    expect(fieldset(form, 'capacity').hidden).toBe(false);
    expect(fieldset(form, 'polarity').hidden).toBe(false);
    expect(fieldset(form, 'brand').hidden).toBe(true);
  });

  it('turns a zero count into a button that sends the chosen filters to the inquiry, and back on the next count', async () => {
    vi.useFakeTimers();
    const backend = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ count: 0 }))
      .mockResolvedValueOnce(Response.json({ count: 4 }));
    vi.stubGlobal('fetch', backend);
    const { form, submit } = sheet();

    edit(form, 'facets');
    await vi.runAllTimersAsync();
    expect(submit.textContent).toBe('Подберем вручную');
    expect(submit.disabled).toBe(false);
    expect(submit.getAttribute('formaction')).toBe('/ru/parts/search/#inquiry');

    edit(form, 'facets');
    expect(submit.hasAttribute('formaction')).toBe(false);
    await vi.runAllTimersAsync();
    expect(submit.textContent).toBe('Показать 4');
    expect(submit.hasAttribute('formaction')).toBe(false);
  });

  it('keeps the plain count for zero when the button has no inquiry wording', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ count: 0 })),
    );
    const { form, submit } = sheet();
    submit.removeAttribute('data-filters-none');
    submit.removeAttribute('data-filters-inquiry');

    edit(form, 'facets');
    await vi.runAllTimersAsync();

    expect(submit.textContent).toBe('Показать 0');
    expect(submit.hasAttribute('formaction')).toBe(false);
  });

  it('announces the new count politely once it arrives', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ count: 7 })),
    );
    const { form } = sheet();
    const live = form.querySelector('[data-filters-live]')!;

    edit(form, 'facets');
    expect(live.textContent).toBe('');
    await vi.runAllTimersAsync();

    expect(live.textContent).toBe('Показать 7');
  });

  it('closes the sheet when the page comes back from the back-forward cache', () => {
    const { form } = sheet();
    const dialog = form.querySelector('dialog')!;
    dialog.close = vi.fn();

    window.dispatchEvent(new Event('pageshow'));
    expect(dialog.close).not.toHaveBeenCalled();

    window.dispatchEvent(
      Object.assign(new Event('pageshow'), { persisted: true }),
    );
    expect(dialog.close).toHaveBeenCalled();
  });

  it('marks a range bound the form would refuse and counts nothing for it', async () => {
    vi.useFakeTimers();
    const backend = vi.fn().mockResolvedValue(Response.json({ count: 5 }));
    vi.stubGlobal('fetch', backend);
    const { form, submit } = sheet();
    const min = input(form, 'min.capacity');

    min.value = '-5';
    edit(form, 'min.capacity');
    await vi.runAllTimersAsync();

    expect(min.getAttribute('aria-invalid')).toBe('true');
    expect(submit.textContent).toBe('Показать');
    expect(submit.hasAttribute('aria-busy')).toBe(false);
    expect(backend).not.toHaveBeenCalled();

    min.value = '75';
    edit(form, 'min.capacity');
    await vi.runAllTimersAsync();

    expect(min.hasAttribute('aria-invalid')).toBe(false);
    expect(submit.textContent).toBe('Показать 5');
  });

  it('puts a form the browser restored on Back to what the URL applied, and recounts it', async () => {
    vi.useFakeTimers();
    const backend = vi.fn().mockResolvedValue(Response.json({ count: 202 }));
    vi.stubGlobal('fetch', backend);
    const { form, submit } = sheet();
    input(form, 'facets', 'brand:bosch').checked = true;
    input(form, 'min.capacity').value = '75';

    window.dispatchEvent(new Event('pageshow'));
    await vi.runAllTimersAsync();

    expect(input(form, 'facets', 'brand:bosch').checked).toBe(false);
    expect(input(form, 'min.capacity').value).toBe('');
    expect(input(form, 'facets', 'brand:varta').checked).toBe(true);
    expect(form.querySelector('filter-sheet')!.hasAttribute('data-dirty')).toBe(
      false,
    );
    expect(submit.textContent).toBe('Показать 202');
  });

  it('resets a sheet the visitor had edited when the page comes back from the back-forward cache', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ count: 202 })),
    );
    const { form } = sheet();
    const sheetElement = form.querySelector('filter-sheet')!;
    input(form, 'facets', 'brand:bosch').checked = true;
    edit(form, 'facets');
    await vi.runAllTimersAsync();
    expect(sheetElement.hasAttribute('data-dirty')).toBe(true);

    window.dispatchEvent(new Event('pageshow'));
    await vi.runAllTimersAsync();

    expect(input(form, 'facets', 'brand:bosch').checked).toBe(false);
    expect(sheetElement.hasAttribute('data-dirty')).toBe(false);
  });

  it('leaves an untouched sheet alone when the page is shown', () => {
    const backend = vi.fn();
    vi.stubGlobal('fetch', backend);
    const { submit } = sheet();

    window.dispatchEvent(new Event('pageshow'));

    expect(submit.textContent).toBe('Показать 202');
    expect(submit.hasAttribute('aria-busy')).toBe(false);
  });
});
