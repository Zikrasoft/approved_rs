import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { afterAll, describe, expect, it } from 'vitest';
import { buildSearchIndex } from './searchIndex';

const site = mkdtempSync(join(tmpdir(), 'carlab-search-'));

const page = (path: string, lang: string, body: string) => {
  mkdirSync(join(site, path), { recursive: true });
  writeFileSync(
    join(site, path, 'index.html'),
    `<!doctype html><html lang="${lang}"><body><header>Meni</header><main>${body}</main></body></html>`,
  );
};

const product = (title: string) =>
  `<section data-pagefind-body><span class="hidden" data-pagefind-meta="title">${title}</span><span class="hidden" data-pagefind-meta="price">11.190 RSD</span><p class="hidden" aria-hidden="true">Akumulatori Bosch 60 Ah 0 092 S40 240 Toyota Corolla 2013–2019</p><dl data-pagefind-ignore><div><dt>Brend</dt><dd>Bosch</dd></div></dl></section>`;

page('ru/shop/batteries/bosch-s4-024', 'ru-RS', product('Bosch S4 024'));
page('sr/shop/batteries/bosch-s4-024', 'sr-Latn-RS', product('Bosch S4 024'));
page('en/shop/batteries/bosch-s4-024', 'en-RS', product('Bosch S4 024'));
page('sr/contact', 'sr-Latn-RS', '<h1>Kontakt</h1><p>Jovana Ćirilova 23a</p>');

afterAll(() => rmSync(site, { recursive: true, force: true }));

describe('buildSearchIndex', () => {
  it('builds one index per locale with the product page in each and nothing else', async () => {
    const out = join(site, 'pagefind');

    const { languages } = await buildSearchIndex(site, [out]);

    expect(languages).toEqual({ 'en-rs': 1, 'ru-rs': 1, 'sr-latn-rs': 1 });
    const fragments = readdirSync(join(out, 'fragment')).map((file) =>
      gunzipSync(readFileSync(join(out, 'fragment', file))).toString(),
    );
    expect(fragments).toHaveLength(3);
    expect(fragments.every((text) => text.includes('0 092 S40 240'))).toBe(
      true,
    );
    expect(fragments.join('')).not.toContain('/sr/contact/');
    expect(fragments.join('')).not.toContain('BrendBosch');
  });

  it('writes the same index to every output it is given', async () => {
    const a = join(site, 'out-a');
    const b = join(site, 'out-b');

    await buildSearchIndex(site, [a, b]);

    expect(readdirSync(a).sort()).toEqual(readdirSync(b).sort());
  });
});
