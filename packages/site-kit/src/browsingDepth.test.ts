// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DEPTH_DOOR_ATTRIBUTE, DEPTH_SLUG_ATTRIBUTE } from './browsingDepth.ts';

const MINUTE = 60 * 1000;
const STORAGE_KEY = 'case_browsing';

let time: number;

const depths = () =>
  (window.ymReachGoal as ReturnType<typeof vi.fn>).mock.calls.map(
    ([goal, params]) => [goal, params.depth],
  );

async function freshPage() {
  vi.resetModules();
  return import('./browsingDepth.ts');
}

async function view(slug: string): Promise<void> {
  document.querySelector(`[${DEPTH_SLUG_ATTRIBUTE}]`)?.remove();
  const article = document.createElement('article');
  article.setAttribute(DEPTH_SLUG_ATTRIBUTE, slug);
  document.body.append(article);
  vi.setSystemTime(time);
  (await freshPage()).defineBrowsingDepth();
}

const door = () => document.querySelector<HTMLElement>('aside')!;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  localStorage.clear();
  document.body.innerHTML = '';
  time = Date.UTC(2026, 9, 5, 12);
  window.ymReachGoal = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete (window as Partial<Window>).ymReachGoal;
});

describe('defineBrowsingDepth', () => {
  it('counts distinct Case studies: A, B, A reads 1, 2, 2', async () => {
    await view('a');
    await view('b');
    await view('a');
    expect(depths()).toEqual([
      ['case_view', 1],
      ['case_view', 2],
      ['case_view', 2],
    ]);
  });

  it('keeps the door hidden on the first Case study and reveals it from the second', async () => {
    document.body.innerHTML = `<aside ${DEPTH_DOOR_ATTRIBUTE}></aside>`;

    await view('a');
    expect(door().dataset.revealed).toBeUndefined();
    await view('b');
    expect(door().dataset.revealed).toBe('true');
    await view('c');
    expect(door().dataset.revealed).toBe('true');
  });

  it('reveals every door on the page', async () => {
    document.body.innerHTML = `<div ${DEPTH_DOOR_ATTRIBUTE}></div><div ${DEPTH_DOOR_ATTRIBUTE}></div>`;
    await view('a');
    await view('b');
    const doors = [...document.querySelectorAll<HTMLElement>('div')];
    expect(doors.map((d) => d.dataset.revealed)).toEqual(['true', 'true']);
  });

  it.each([
    ['no slug element', ''],
    ['an empty slug', `<article ${DEPTH_SLUG_ATTRIBUTE}=""></article>`],
  ])('does nothing on a page with %s', async (_, markup) => {
    document.body.innerHTML = markup;
    (await freshPage()).defineBrowsingDepth();
    expect(depths()).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('starts a new visit after more than 30 minutes without a Case study view', async () => {
    await view('a');
    time += 30 * MINUTE + 1;
    await view('b');
    expect(depths().at(-1)).toEqual(['case_view', 1]);
  });

  it('keeps counting when the gap is just under 30 minutes', async () => {
    await view('a');
    time += 30 * MINUTE - 1;
    await view('b');
    expect(depths().at(-1)).toEqual(['case_view', 2]);
  });

  it.each([
    ['not JSON', () => '{oops'],
    ['not an object', () => '42'],
    ['null', () => 'null'],
    [
      'a timestamp not a number',
      () => JSON.stringify({ slugs: ['x'], at: String(time) }),
    ],
    ['a timestamp not finite', () => '{"slugs":["x"],"at":1e999}'],
    ['slugs not a list', () => JSON.stringify({ slugs: 'x', at: time })],
    ['a slug not a string', () => JSON.stringify({ slugs: [1], at: time })],
  ])('treats a malformed stored value (%s) as empty', async (_, raw) => {
    localStorage.setItem(STORAGE_KEY, raw());
    await view('a');
    expect(depths()).toEqual([['case_view', 1]]);
  });

  it.each([['getItem'], ['setItem']] as const)(
    'reports depth 1 and keeps the door hidden when storage throws on %s',
    async (method) => {
      document.body.innerHTML = `<aside ${DEPTH_DOOR_ATTRIBUTE}></aside>`;
      await view('a');
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new Error('SecurityError');
      });
      await view('b');
      expect(depths().at(-1)).toEqual(['case_view', 1]);
      expect(door().dataset.revealed).toBeUndefined();
    },
  );

  it('fires no second goal when armed twice on one page', async () => {
    await view('a');
    const { defineBrowsingDepth } = await import('./browsingDepth.ts');
    defineBrowsingDepth();
    expect(depths()).toEqual([['case_view', 1]]);
  });
});
