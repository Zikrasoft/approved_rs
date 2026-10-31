// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GOALS } from '@podbor/site-kit/browser';
import { defineCatalogueSearch, SUGGEST_DELAY_MS } from './catalogueSearch';

const suggestions = {
  vin: false,
  cars: [{ href: '/ru/parts/bmw/e83-x3-20d/', label: 'BMW X3 E83' }],
  parts: [
    {
      href: '/ru/parts/p/mann-filter-hu816x/',
      label: 'Mann-Filter HU 816 x',
      detail: 'Масляный фильтр',
      thumb: null,
    },
  ],
};

const backend = vi.fn();
const trackGoal = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', backend);
  window.trackGoal = trackGoal;
  backend.mockResolvedValue(Response.json(suggestions));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  backend.mockReset();
  trackGoal.mockReset();
  document.body.innerHTML = '';
});

const mount = () => {
  defineCatalogueSearch();
  document.body.innerHTML = `
    <catalogue-search
      data-endpoint="/api/search"
      data-locale="ru"
      data-cars-label="Автомобили"
      data-parts-label="Запчасти"
      data-vin-label="Подобрать по VIN"
      data-failed-label="Подсказки не загрузились"
      data-retry-label="Повторить"
    >
      <form action="/ru/parts/search/" method="GET" role="search">
        <input type="search" name="q" />
      </form>
      <div data-suggestions hidden></div>
    </catalogue-search>`;
  const input = document.querySelector('input')!;
  const panel = document.querySelector<HTMLElement>('[data-suggestions]')!;
  return { input, panel };
};

const type = async (input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event('input'));
  await vi.advanceTimersByTimeAsync(SUGGEST_DELAY_MS);
};

const key = (input: HTMLInputElement, name: string) => {
  const event = new KeyboardEvent('keydown', { key: name, cancelable: true });
  input.dispatchEvent(event);
  return event;
};

const options = (panel: HTMLElement) =>
  [...panel.querySelectorAll('[role="option"]')].map((option) =>
    option.textContent?.trim().replace(/\s+/g, ' '),
  );

describe('the catalogue search box', () => {
  it('suggests cars and parts in their groups while the visitor types', async () => {
    const { input, panel } = mount();

    await type(input, 'bmw x3');

    expect(backend).toHaveBeenCalledWith(
      '/api/search?q=bmw+x3&locale=ru',
      expect.anything(),
    );
    expect(panel.hidden).toBe(false);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(
      [...panel.querySelectorAll('[role="group"]')].map((group) =>
        group.getAttribute('aria-label'),
      ),
    ).toEqual(['Автомобили', 'Запчасти']);
    expect(options(panel)).toEqual([
      'BMW X3 E83',
      'Mann-Filter HU 816 x Масляный фильтр',
    ]);
  });

  it('waits for a second character before asking', async () => {
    const { input } = mount();

    await type(input, 'b');

    expect(backend).not.toHaveBeenCalled();
  });

  it('asks once for a burst of typing', async () => {
    const { input } = mount();

    input.value = 'bm';
    input.dispatchEvent(new Event('input'));
    await type(input, 'bmw');

    expect(backend).toHaveBeenCalledTimes(1);
  });

  it('walks the suggestions with the arrow keys and opens one with Enter', async () => {
    const { input, panel } = mount();
    await type(input, 'bmw x3');
    const [car, part] =
      panel.querySelectorAll<HTMLAnchorElement>('[role="option"]');
    const opened = vi.fn((event: Event) => event.preventDefault());
    part.addEventListener('click', opened);

    key(input, 'ArrowDown');
    expect(input.getAttribute('aria-activedescendant')).toBe(car.id);
    key(input, 'ArrowDown');
    expect(input.getAttribute('aria-activedescendant')).toBe(part.id);
    expect(part.getAttribute('aria-selected')).toBe('true');
    const enter = key(input, 'Enter');

    expect(enter.defaultPrevented).toBe(true);
    expect(opened).toHaveBeenCalledOnce();
    expect(trackGoal).toHaveBeenCalledWith(GOALS.searchSuggestionPick, {
      group: 'parts',
    });
  });

  it('leaves Enter to the form when no suggestion is chosen', async () => {
    const { input } = mount();
    await type(input, 'bmw x3');

    expect(key(input, 'Enter').defaultPrevented).toBe(false);
  });

  it('counts a submitted search', async () => {
    const { input } = mount();
    input.value = 'bmw x3';
    const form = document.querySelector('form')!;
    form.addEventListener('submit', (event) => event.preventDefault());

    form.dispatchEvent(new Event('submit', { cancelable: true }));

    expect(trackGoal).toHaveBeenCalledWith(GOALS.search, { kind: 'query' });
  });

  it('keeps the field focused while a suggestion is pressed, so the tap lands', async () => {
    const { input, panel } = mount();
    await type(input, 'bmw x3');
    const [car] = panel.querySelectorAll('[role="option"]');

    const press = new Event('pointerdown', { bubbles: true, cancelable: true });
    car.dispatchEvent(press);

    expect(press.defaultPrevented).toBe(true);
    expect(panel.hidden).toBe(false);
  });

  it('closes the suggestions on Escape', async () => {
    const { input, panel } = mount();
    await type(input, 'bmw x3');

    key(input, 'Escape');

    expect(panel.hidden).toBe(true);
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('offers the VIN lookup for a VIN', async () => {
    backend.mockResolvedValue(
      Response.json({ vin: true, cars: [], parts: [] }),
    );
    const { input, panel } = mount();

    await type(input, 'WBA35BG070N074158');

    const [option] =
      panel.querySelectorAll<HTMLAnchorElement>('[role="option"]');
    expect(option.textContent).toContain('Подобрать по VIN');
    expect(panel.textContent?.split('Подобрать по VIN')).toHaveLength(2);
    expect(option.getAttribute('href')).toBe(
      '/ru/parts/search/?q=WBA35BG070N074158',
    );
  });

  it('hides the panel when nothing is found', async () => {
    backend.mockResolvedValue(
      Response.json({ vin: false, cars: [], parts: [] }),
    );
    const { input, panel } = mount();

    await type(input, 'qqqq');

    expect(panel.hidden).toBe(true);
  });

  it('marks itself busy while it waits for suggestions', async () => {
    let answer: (response: Response) => void = () => {};
    backend.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const { input } = mount();
    const box = document.querySelector('catalogue-search')!;

    await type(input, 'bmw');
    expect(box.getAttribute('aria-busy')).toBe('true');

    answer(Response.json(suggestions));
    await vi.advanceTimersByTimeAsync(0);
    expect(box.hasAttribute('aria-busy')).toBe(false);
  });

  it('swaps a picture that fails to load for an empty frame', async () => {
    backend.mockResolvedValue(
      Response.json({
        ...suggestions,
        parts: [{ ...suggestions.parts[0], thumb: '/missing.jpg' }],
      }),
    );
    const { input, panel } = mount();

    await type(input, 'hu 816');
    panel.querySelector('img')!.dispatchEvent(new Event('error'));

    expect(panel.querySelector('img')).toBeNull();
    expect(
      panel.querySelector('[role="option"] > span[aria-hidden="true"]'),
    ).not.toBeNull();
  });

  it('keeps quiet about a request a newer keystroke replaced', async () => {
    backend.mockImplementationOnce(
      (_url: string, { signal }: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const { input, panel } = mount();

    await type(input, 'bmw');
    await type(input, 'bmw x3');

    expect(panel.querySelector('button')).toBeNull();
    expect(options(panel)).toEqual([
      'BMW X3 E83',
      'Mann-Filter HU 816 x Масляный фильтр',
    ]);
  });

  it('drops the pending answer as soon as the visitor types on', async () => {
    let signal: AbortSignal | undefined;
    backend.mockImplementationOnce(
      (_url: string, init: { signal: AbortSignal }) => {
        signal = init.signal;
        return new Promise(() => {});
      },
    );
    const { input } = mount();
    await type(input, 'bmw');

    input.value = 'bmw x';
    input.dispatchEvent(new Event('input'));

    expect(signal?.aborted).toBe(true);
  });

  it.each([
    [
      'answers with an error',
      () => Promise.resolve(new Response(null, { status: 503 })),
    ],
    [
      'cannot be reached',
      () => Promise.reject(new TypeError('Failed to fetch')),
    ],
  ])('offers a retry when the search %s', async (_, failure) => {
    backend.mockImplementationOnce(failure);
    const { input, panel } = mount();

    await type(input, 'bmw x3');

    expect(panel.hidden).toBe(false);
    expect(panel.textContent).toContain('Подсказки не загрузились');
    expect(panel.textContent).not.toContain('Failed to fetch');
    expect(panel.querySelector('[role="status"]')?.textContent).toContain(
      'Подсказки не загрузились',
    );
    const retry = panel.querySelector('button')!;
    retry.focus();
    retry.click();
    await vi.advanceTimersByTimeAsync(0);

    expect(document.activeElement).toBe(input);
    expect(backend).toHaveBeenCalledTimes(2);
    expect(options(panel)).toEqual([
      'BMW X3 E83',
      'Mann-Filter HU 816 x Масляный фильтр',
    ]);
  });

  it('suggests for what was typed before it woke up', async () => {
    const input = document.createElement('input');
    document.body.innerHTML = `
      <late-search data-endpoint="/api/search" data-locale="ru">
        <form action="/ru/parts/search/"></form>
        <div data-suggestions hidden></div>
      </late-search>`;
    input.name = 'q';
    document.querySelector('form')!.append(input);
    input.focus();
    input.value = 'e90';

    defineCatalogueSearch('late-search');
    await vi.advanceTimersByTimeAsync(SUGGEST_DELAY_MS);

    expect(backend).toHaveBeenCalledWith(
      '/api/search?q=e90&locale=ru',
      expect.anything(),
    );
  });
});
