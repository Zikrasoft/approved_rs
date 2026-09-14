import { describe, it, expect } from 'vitest';
import { errorMessage } from './errorMessage.ts';

describe('errorMessage', () => {
  it('uses the message of a real Error', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
  });

  it('stringifies anything else a throw site might produce', () => {
    expect(errorMessage('plain string')).toBe('plain string');
    expect(errorMessage(42)).toBe('42');
    expect(errorMessage(undefined)).toBe('undefined');
  });
});
