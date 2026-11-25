import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  brokenAnswer,
  cachedNotFound,
  caddyServes,
  catalogueCaches,
  linksCaddy404,
  shadowedRedirects,
} from './caddy-split.ts';

const rules = [
  { source: '/old', destination: '/ru/new/' },
  { source: '/old/', destination: '/ru/new/' },
  { source: '/legacy.txt', destination: '/ru/' },
  { source: '/', destination: '/ru/' },
];

test('a page directory is served under its file, its slash and its bare path', () => {
  assert.deepEqual(caddyServes(['/old/index.html']), [
    '/old/index.html',
    '/old/',
    '/old',
  ]);
});

test('the root index is served under the bare root', () => {
  assert.deepEqual(caddyServes(['/index.html']), ['/index.html', '/']);
});

test('a plain file is served under its own path only', () => {
  assert.deepEqual(caddyServes(['/_astro/app.js']), ['/_astro/app.js']);
});

test('names every served path a redirect rule also matches', () => {
  assert.deepEqual(
    shadowedRedirects(rules, ['/old/index.html', '/legacy.txt', '/index.html']),
    ['/old/', '/old', '/legacy.txt', '/'],
  );
});

test('passes files no rule matches', () => {
  assert.deepEqual(
    shadowedRedirects(rules, ['/ru/index.html', '/_astro/app.js']),
    [],
  );
});

test('flags a page that links /_image, which Caddy answers 404', () => {
  assert.equal(linksCaddy404('<img src="/_image?href=x">'), true);
  assert.equal(linksCaddy404('<img src="/_astro/a.webp">'), false);
});

test('a catalogue page without its shop asks to retry, which is not a broken page', () => {
  assert.equal(brokenAnswer(503), false);
  assert.equal(brokenAnswer(500), true);
  assert.equal(brokenAnswer(404), false);
});

test('an unknown slug is a 404 page the cache may keep, never a bare or private one', () => {
  const kept = 'public, s-maxage=86400, stale-while-revalidate=86400';
  const page = '<main data-site-body></main>';
  assert.equal(cachedNotFound(404, kept, page), true);
  assert.equal(cachedNotFound(404, null, page), false);
  assert.equal(cachedNotFound(404, 'private, no-store', page), false);
  assert.equal(cachedNotFound(404, kept, ''), false);
  assert.equal(cachedNotFound(200, kept, page), false);
});

test('the Caddyfile caches every catalogue page and never the search, cart or prices', () => {
  const caches = catalogueCaches(
    readFileSync('infra/auto-service-shop/caddy/Caddyfile', 'utf8'),
  );
  for (const path of [
    '/ru/parts/p/bosch-0986494524/',
    '/sr/parts/c/brakes/2/',
    '/ru/parts/bmw/3-series/oil-filters/',
    '/en/cars/bmw/',
  ])
    assert.equal(caches(path), true, path);
  for (const path of ['/ru/parts/search/', '/ru/parts/cart', '/ru/parts/'])
    assert.equal(caches(path), false, path);
});
