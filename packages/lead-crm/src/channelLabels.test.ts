import { describe, it, expect } from 'vitest';
import { channelLabel } from './channelLabels.ts';

describe('channelLabel', () => {
  it('names a tracked channel the way the owner reads it', () => {
    expect(channelLabel('whatsapp')).toBe('WhatsApp');
    expect(channelLabel('phone')).toBe('звонок');
  });
});
