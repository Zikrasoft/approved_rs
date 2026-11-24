import { describe, it, expect } from 'vitest';
import { renderId } from './renderId.ts';

describe('renderId', () => {
  it('counts up within one render', () => {
    const render = {};
    expect([renderId(render), renderId(render), renderId(render)]).toEqual([
      '1',
      '2',
      '3',
    ]);
  });

  it('starts over for every render, so a rebuilt page keeps its ids', () => {
    const first = {};
    const second = {};
    renderId(first);
    expect(renderId(first)).toBe('2');
    expect(renderId(second)).toBe('1');
  });
});
