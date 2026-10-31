import { Readable } from 'node:stream';

import { readCapped } from '../uploads';

const chunked = (...parts: string[]) =>
  Readable.from(parts.map((part) => Buffer.from(part)));

describe('readCapped', () => {
  it('joins a stream up to the cap', async () => {
    expect(
      (await readCapped(chunked('ab', 'cd'), 4, () => new Error())).toString(),
    ).toBe('abcd');
  });

  it('refuses a stream past the cap, counting bytes rather than headers', async () => {
    const stream = chunked('ab', 'cd', 'e');

    await expect(
      readCapped(stream, 4, () => new Error('too large')),
    ).rejects.toThrow('too large');
    expect(stream.destroyed).toBe(true);
  });
});
