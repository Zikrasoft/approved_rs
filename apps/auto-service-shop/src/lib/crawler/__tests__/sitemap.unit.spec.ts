import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';

describe('sitemapLinks', () => {
  it("keeps the pages of several large sitemaps without holding the sitemaps themselves in the crawler's heap", async () => {
    const readInChild = `
      const { sitemapLinks } = require(${JSON.stringify(join(__dirname, '..', 'sitemap.ts'))});
      const entry = '<url><loc>https://example.test/p/1</loc><image:image><image:title>Filter ulja Čep</image:title></image:image></url>';
      const sitemap = Buffer.from('<urlset>' + entry.repeat(40e6 / entry.length) + '</urlset>');
      let found = [];
      for (let file = 0; file < 4; file += 1) found = found.concat(sitemapLinks(sitemap).pages);
      console.log('pages kept', found.length);
    `;

    const { stdout } = await promisify(execFile)(process.execPath, [
      '--max-old-space-size=160',
      require.resolve('ts-node/dist/bin-transpile.js'),
      '-e',
      readInChild,
    ]);

    expect(stdout).toMatch(/pages kept \d{6}/u);
  }, 120_000);
});
