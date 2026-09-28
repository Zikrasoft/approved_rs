import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

describe('CommonJS build', () => {
  it('resolves the Medusa-facing subpaths to dist/cjs', () => {
    expect(require.resolve('@podbor/i18n/translate/core')).toMatch(
      /dist\/cjs\/translate\/core\.js$/,
    );
    expect(require.resolve('@podbor/i18n/section')).toMatch(
      /dist\/cjs\/section\.js$/,
    );
  });

  it('serves the translation core to require()', () => {
    const core = require('@podbor/i18n/translate/core');
    expect(core.sha256Hex('a')).toBe('ca978112ca1bbdca');
    expect(typeof core.translateFields).toBe('function');
    expect(typeof core.assertSafeTranslation).toBe('function');
  });

  it('serves the section loader to require()', () => {
    const section = require('@podbor/i18n/section');
    expect(section.withPlaceholder('Заказ №{n}', 'n', '7')).toBe('Заказ №7');
    expect(typeof section.createSectionLoader).toBe('function');
  });
});
