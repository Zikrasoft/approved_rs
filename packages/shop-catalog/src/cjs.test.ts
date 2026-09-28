import { beforeAll, describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);

describe('CommonJS build', () => {
  beforeAll(() => {
    execFileSync('pnpm', ['run', 'build'], { cwd: root, stdio: 'pipe' });
  }, 120_000);

  it('serves the package root to require()', () => {
    const shop = require('@podbor/shop-catalog');
    expect(shop.productType('batteries').key).toBe('batteries');
    expect(shop.parseAttributes('batteries', {}).ok).toBe(false);
    expect(shop.landingSlug(shop.productType('batteries').fields[1], 60)).toBe(
      '60ah',
    );
  });

  it('serves the order hook to require()', () => {
    const hook = require('@podbor/shop-catalog/order-hook');
    const header = hook.signHook('{}', 'secret', 1_790_000_000_000);
    expect(hook.verifyHook('{}', header, 'secret', 1_790_000_000_000)).toBe(
      true,
    );
  });
});
