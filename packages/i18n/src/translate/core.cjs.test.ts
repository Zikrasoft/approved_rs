import { beforeAll, describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const require = createRequire(import.meta.url);

describe('translate/core CommonJS build', () => {
  beforeAll(() => {
    execFileSync('pnpm', ['run', 'build'], { cwd: root, stdio: 'pipe' });
  }, 120_000);

  it('serves the translation core to require()', () => {
    const core = require('@podbor/i18n/translate/core');
    expect(core.sha256Hex('a')).toBe('ca978112ca1bbdca');
    expect(typeof core.translateFields).toBe('function');
    expect(typeof core.assertSafeTranslation).toBe('function');
  });
});
