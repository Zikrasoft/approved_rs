// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DEPTH_DOOR_ATTRIBUTE, defineBrowsingDepth } from './browsingDepth.ts';

const MINUTE = 60 * 1000;

let storage: Storage;
let time: number;
let page: AbortController;

const depths = () =>
  (window.ymReachGoal as ReturnType<typeof vi.fn>).mock.calls.map(
    ([goal, params]) => [goal, params.depth],
  );

function view(slug: string): void {
  page.abort();
  page = new AbortController();
  defineBrowsingDepth(slug, {
    storage,
    now: () => time,
    signal: page.signal,
  });
}

beforeEach(() => {
  storage = window.localStorage;
  storage.clear();
  document.body.innerHTML = '';
  time = Date.UTC(2026, 9, 5, 12);
  page = new AbortController();
  window.ymReachGoal = vi.fn();
});

afterEach(() => {
  page.abort();
  delete (window as Partial<Window>).ymReachGoal;
});

describe('defineBrowsingDepth', () => {
  it('counts distinct Case studies: A, B, A reads 1, 2, 2', () => {
    view('a');
    view('b');
    view('a');
    expect(depths()).toEqual([
      ['case_view', 1],
      ['case_view', 2],
      ['case_view', 2],
    ]);
  });

  it('keeps the door hidden on the first Case study and reveals it from the second', () => {
    document.body.innerHTML = `<aside ${DEPTH_DOOR_ATTRIBUTE}></aside>`;
    const door = document.querySelector<HTMLElement>('aside')!;

    view('a');
    expect(door.dataset.revealed).toBeUndefined();
    view('b');
    expect(door.dataset.revealed).toBe('true');
    view('c');
    expect(door.dataset.revealed).toBe('true');
  });

  it('reveals every door on the page', () => {
    document.body.innerHTML = `<div ${DEPTH_DOOR_ATTRIBUTE}></div><div ${DEPTH_DOOR_ATTRIBUTE}></div>`;
    view('a');
    view('b');
    const doors = [...document.querySelectorAll<HTMLElement>('div')];
    expect(doors.map((door) => door.dataset.revealed)).toEqual([
      'true',
      'true',
    ]);
  });

  it('starts a new visit after more than 30 minutes without a Case study view', () => {
    view('a');
    time += 30 * MINUTE + 1;
    view('b');
    expect(depths().at(-1)).toEqual(['case_view', 1]);
  });

  it('keeps counting when the gap is just under 30 minutes', () => {
    view('a');
    time += 30 * MINUTE - 1;
    view('b');
    expect(depths().at(-1)).toEqual(['case_view', 2]);
  });

  it.each([
    ['not JSON', '{oops'],
    ['not an object', '42'],
    ['null', 'null'],
    ['no timestamp', JSON.stringify({ slugs: ['x'] })],
    ['slugs not a list', JSON.stringify({ slugs: 'x', at: Date.now() })],
    ['a slug not a string', JSON.stringify({ slugs: [1], at: Date.now() })],
  ])('treats a malformed stored value (%s) as empty', (_, raw) => {
    storage = { getItem: () => raw, setItem: () => undefined } as never;
    view('a');
    expect(depths()).toEqual([['case_view', 1]]);
  });

  it.each([
    ['read', 'getItem'],
    ['write', 'setItem'],
  ])(
    'reports depth 1 and keeps the door hidden when storage throws on %s',
    (_, method) => {
      document.body.innerHTML = `<aside ${DEPTH_DOOR_ATTRIBUTE}></aside>`;
      view('a');
      const working = storage;
      storage = {
        getItem: (key: string) => working.getItem(key),
        setItem: (key: string, value: string) => working.setItem(key, value),
        [method]: () => {
          throw new Error('SecurityError');
        },
      } as never;
      expect(() => view('b')).not.toThrow();
      expect(depths().at(-1)).toEqual(['case_view', 1]);
      expect(
        document.querySelector<HTMLElement>('aside')!.dataset.revealed,
      ).toBeUndefined();
    },
  );

  it('fires no second goal when armed twice on one page', () => {
    view('a');
    defineBrowsingDepth('b', { storage, now: () => time });
    expect(depths()).toEqual([['case_view', 1]]);
  });

  it('falls back to localStorage and the real clock', () => {
    page.abort();
    page = new AbortController();
    defineBrowsingDepth('a', { signal: page.signal });
    page.abort();
    page = new AbortController();
    defineBrowsingDepth('b', { signal: page.signal });
    expect(depths()).toEqual([
      ['case_view', 1],
      ['case_view', 2],
    ]);
  });
});
