import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { describeSectionRegistry } from '@podbor/i18n/testing';
import { SECTIONS } from '@/i18n/sections';
import { ARTICLE_DIRS, WORK_DIRS } from '../../../scripts/translate-works';

describeSectionRegistry(SECTIONS);

describe('content directory registry', () => {
  it.each([...WORK_DIRS, ...ARTICLE_DIRS])('%s exists', (dir) => {
    expect(existsSync(dir)).toBe(true);
  });
});
