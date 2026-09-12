import { describe, it, expect } from 'vitest';
import { sha256Hex } from './sha256Hex';

describe('sha256Hex', () => {
  it('is stable for the same input', () => {
    expect(sha256Hex('a')).toBe(sha256Hex('a'));
  });

  it('changes when the input changes', () => {
    expect(sha256Hex('a')).not.toBe(sha256Hex('b'));
  });

  it('defaults to a 16-character hex string', () => {
    expect(sha256Hex('a')).toMatch(/^[0-9a-f]{16}$/);
  });

  it('respects a custom length', () => {
    expect(sha256Hex('a', 8)).toMatch(/^[0-9a-f]{8}$/);
  });
});
