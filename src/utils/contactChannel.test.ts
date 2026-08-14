import { describe, it, expect } from 'vitest';
import { isTrackedContactChannel, TRACKED_CONTACT_CHANNELS } from './contactChannel';

describe('isTrackedContactChannel', () => {
  it('is true for every tracked channel', () => {
    for (const channel of TRACKED_CONTACT_CHANNELS) {
      expect(isTrackedContactChannel(channel)).toBe(true);
    }
  });

  it('is false for callback — same attribute, but opens the lead modal instead of tracking', () => {
    expect(isTrackedContactChannel('callback')).toBe(false);
  });

  it('is false for null/undefined/empty string', () => {
    expect(isTrackedContactChannel(null)).toBe(false);
    expect(isTrackedContactChannel(undefined)).toBe(false);
    expect(isTrackedContactChannel('')).toBe(false);
  });

  it('is false for Object.prototype member names — the whole reason this is a guard and not a raw object-key lookup', () => {
    expect(isTrackedContactChannel('constructor')).toBe(false);
    expect(isTrackedContactChannel('toString')).toBe(false);
    expect(isTrackedContactChannel('hasOwnProperty')).toBe(false);
  });
});
