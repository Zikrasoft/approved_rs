// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  forgetVisitorId,
  getOrCreateVisitorId,
  VISITOR_ID_COOKIE,
  VISITOR_ID_COOKIE_MAX_AGE,
} from './visitorId.ts';

const UUID = '0f8fad5b-d9cb-469f-a165-70867728950e';
let written: string[];

beforeEach(() => {
  localStorage.clear();
  written = [];
  vi.restoreAllMocks();
  vi.spyOn(document, 'cookie', 'set').mockImplementation((value: string) => {
    written.push(value);
  });
  vi.stubGlobal('crypto', { randomUUID: () => UUID });
});

const mirrored = (id: string) =>
  `${VISITOR_ID_COOKIE}=${id}; path=/; max-age=${VISITOR_ID_COOKIE_MAX_AGE}; samesite=lax; secure`;
const cleared = `${VISITOR_ID_COOKIE}=; path=/; max-age=0; samesite=lax; secure`;

describe('getOrCreateVisitorId', () => {
  it('returns the id already stored for this browser and mirrors it into the cookie', () => {
    localStorage.setItem('visitor_id', 'existing');
    expect(getOrCreateVisitorId()).toBe('existing');
    expect(written).toEqual([mirrored('existing')]);
  });

  it('generates and persists an id on first use', () => {
    expect(getOrCreateVisitorId()).toBe(UUID);
    expect(localStorage.getItem('visitor_id')).toBe(UUID);
    expect(written).toEqual([mirrored(UUID)]);
  });

  it('mints an id for a visitor who accepted', () => {
    localStorage.setItem(
      'cookie_consent',
      JSON.stringify({ version: '1', at: 'now', analytics: true }),
    );
    expect(getOrCreateVisitorId()).toBe(UUID);
  });

  it('mints no id and clears the cookie for a visitor who declined', () => {
    localStorage.setItem(
      'cookie_consent',
      JSON.stringify({ version: '1', at: 'now', analytics: false }),
    );
    expect(getOrCreateVisitorId()).toBe('');
    expect(localStorage.getItem('visitor_id')).toBeNull();
    expect(written).toEqual([cleared]);
  });

  it('stops handing back an id already stored before the refusal', () => {
    localStorage.setItem('visitor_id', 'existing');
    localStorage.setItem('cookie_consent', 'denied');
    expect(getOrCreateVisitorId()).toBe('');
    expect(written).toEqual([cleared]);
  });

  it('returns an empty id instead of throwing when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(getOrCreateVisitorId()).toBe('');
    expect(written).toEqual([cleared]);
  });

  it('returns an empty id when writing is blocked after a successful read', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(getOrCreateVisitorId()).toBe('');
  });

  it('still answers when the cookie cannot be written', () => {
    vi.spyOn(document, 'cookie', 'set').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(getOrCreateVisitorId()).toBe(UUID);
  });
});

describe('forgetVisitorId', () => {
  it('drops the id and its cookie so a later acceptance starts a new one', () => {
    localStorage.setItem('visitor_id', 'existing');
    forgetVisitorId();
    expect(localStorage.getItem('visitor_id')).toBeNull();
    expect(written).toEqual([cleared]);
  });

  it('says nothing when storage refuses the delete', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => forgetVisitorId()).not.toThrow();
    expect(written).toEqual([cleared]);
  });
});
