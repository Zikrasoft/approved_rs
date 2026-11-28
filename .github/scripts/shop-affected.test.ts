import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const scripts = new URL('.', import.meta.url).pathname;
const root = new URL('../../', import.meta.url).pathname;

const workspaceDeps = (dir: string): string[] => {
  const pkg = JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8'));
  return Object.keys({
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
  })
    .filter((name) => name.startsWith('@podbor/'))
    .map((name) => `packages/${name.slice('@podbor/'.length)}`);
};

const shopClosure = (): string[] => {
  const seen = new Set<string>();
  const walk = (dir: string) => {
    for (const dep of workspaceDeps(dir)) {
      if (!seen.has(dep)) {
        seen.add(dep);
        walk(dep);
      }
    }
  };
  walk('apps/auto-service-shop');
  return [...seen].toSorted();
};

test('the script watches every workspace package the shop depends on', () => {
  const watched =
    readFileSync(join(scripts, 'shop-affected.sh'), 'utf8').match(
      /packages\/[\w-]+/g,
    ) ?? [];
  assert.deepEqual(watched.toSorted(), shopClosure());
  assert.ok(readdirSync(join(root, 'packages')).length > shopClosure().length);
});

test('the shop is affected only by its own paths, against the check base', () => {
  const work = mkdtempSync(join(tmpdir(), 'shop-affected-'));
  try {
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: work, encoding: 'utf8' }).trim();
    const commit = (path: string) => {
      mkdirSync(dirname(join(work, path)), { recursive: true });
      writeFileSync(join(work, path), `${Math.random()}`);
      git('add', path);
      git('commit', '-qm', path);
    };
    const affected = () =>
      execFileSync('sh', ['.github/scripts/shop-affected.sh'], {
        cwd: work,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    const deploy = () => {
      for (const app of ['auto-service', 'auto-service-shop'])
        git('tag', '-f', `deployed/${app}`, 'HEAD');
    };

    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'ci@example.com');
    git('config', 'user.name', 'ci');
    for (const file of [
      'shop-affected.sh',
      'check-base.sh',
      'root-changed.sh',
    ]) {
      cpSync(join(scripts, file), join(work, '.github/scripts', file));
    }
    git('add', '.github');
    commit('apps/auto-service/index.ts');
    assert.equal(affected(), 'true', 'no deployed tag');

    deploy();
    commit('apps/auto-service/index.ts');
    commit('packages/site-kit/index.ts');
    assert.equal(affected(), 'false', 'a site-only push');

    for (const path of [
      'apps/auto-service-shop/src/index.ts',
      'infra/auto-service-shop/deploy.sh',
      'packages/catalog-contract/index.ts',
      'packages/lead-crm/index.ts',
      'packages/brands/index.ts',
      'packages/i18n/index.ts',
      'pnpm-lock.yaml',
      '.github/workflows/ci.yml',
    ]) {
      const tip = git('rev-parse', 'HEAD');
      commit(path);
      assert.equal(affected(), 'true', path);
      git('reset', '-q', '--hard', tip);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});
