import { describe, it, expect } from 'vitest';
import { channelLabel } from './channelLabels.ts';

describe('channelLabel', () => {
  it('names a tracked channel the way an operator reads it', () => {
    expect(channelLabel('whatsapp')).toBe('WhatsApp');
    expect(channelLabel('phone')).toBe('звонок');
  });

  it('shows a channel it has no label for as it is stored', () => {
    expect(channelLabel('signal')).toBe('signal');
  });

  it('does not hand back a prototype member for a crafted channel', () => {
    expect(channelLabel('constructor')).toBe('constructor');
    expect(channelLabel('toString')).toBe('toString');
  });
});
