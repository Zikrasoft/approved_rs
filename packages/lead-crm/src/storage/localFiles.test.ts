import { describe, expect, it } from 'vitest';
import * as file from './file.ts';
import { fromLocalFiles } from './localFiles.ts';
import { LOCAL_DATA_DIR } from './types.ts';

describe('fromLocalFiles', () => {
  it('hands every caller the one file storage module and the local data dir', async () => {
    const seen = await Promise.all([
      fromLocalFiles((module, dir) => ({ module, dir })),
      fromLocalFiles((module, dir) => ({ module, dir })),
    ]);

    for (const { module, dir } of seen) {
      expect(module.createFileStorage).toBe(file.createFileStorage);
      expect(dir).toBe(LOCAL_DATA_DIR);
    }
  });
});
