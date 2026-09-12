import { describe, it, expect } from 'vitest';
import {
  TRACKED_CONTACT_CHANNELS,
  isTrackedContactChannel,
} from './contactChannel.ts';

describe('isTrackedContactChannel', () => {
  it.each(TRACKED_CONTACT_CHANNELS)('accepts %s', (channel) => {
    expect(isTrackedContactChannel(channel)).toBe(true);
  });

  it.each(['sms', '', 'Phone', 'constructor', 'toString'])(
    'rejects %s',
    (value) => {
      expect(isTrackedContactChannel(value)).toBe(false);
    },
  );

  it('rejects null and undefined', () => {
    expect(isTrackedContactChannel(null)).toBe(false);
    expect(isTrackedContactChannel(undefined)).toBe(false);
  });
});
