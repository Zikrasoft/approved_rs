import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const page = {
  setContent: vi.fn(),
  evaluate: vi.fn(),
  screenshot: vi.fn(async () => Buffer.from('png')),
};
const browser = {
  newPage: vi.fn(async () => page),
  close: vi.fn(),
};
vi.mock('playwright-core', () => ({
  chromium: { launch: vi.fn(async () => browser) },
}));

const {
  FIT_TEXT_SCRIPT,
  OG_HEIGHT,
  OG_WIDTH,
  dataUri,
  escapeHtml,
  inlineFontCss,
  renderOgImages,
} = await import('./ogImage.ts');

const tmp = () => mkdtempSync(join(tmpdir(), 'og-'));

afterEach(() => vi.clearAllMocks());

describe('dataUri', () => {
  it('encodes bytes under the media type of the extension', () => {
    expect(dataUri(Buffer.from('hi'), '.JPG')).toBe(
      'data:image/jpeg;base64,aGk=',
    );
  });

  it('refuses an extension it has no media type for', () => {
    expect(() => dataUri(Buffer.from(''), '.txt')).toThrow('.txt');
  });
});

describe('inlineFontCss', () => {
  it('replaces every relative font url with its bytes, quoted or not', () => {
    const dir = tmp();
    mkdirSync(join(dir, 'files'));
    writeFileSync(join(dir, 'files', 'a.woff2'), 'A');
    writeFileSync(join(dir, 'b.woff'), 'B');
    writeFileSync(
      join(dir, 'font.css'),
      `src: url(./files/a.woff2) format('woff2'), url('./b.woff') format('woff');`,
    );

    expect(inlineFontCss(join(dir, 'font.css'))).toBe(
      `src: url(data:font/woff2;base64,QQ==) format('woff2'), url(data:font/woff;base64,Qg==) format('woff');`,
    );
  });
});

describe('escapeHtml', () => {
  it('escapes the five characters that break markup', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
  });
});

describe('renderOgImages', () => {
  it('screenshots each page at OG size after fonts load and text fits', async () => {
    const dir = tmp();
    const out = join(dir, 'og.png');
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await renderOgImages([{ html: '<p>x</p>', out }]);

    expect(browser.newPage).toHaveBeenCalledWith({
      viewport: { width: OG_WIDTH, height: OG_HEIGHT },
    });
    expect(page.setContent).toHaveBeenCalledWith('<p>x</p>', {
      waitUntil: 'load',
    });
    expect(page.evaluate.mock.calls).toEqual([
      ['document.fonts.ready'],
      [FIT_TEXT_SCRIPT],
    ]);
    expect(readFileSync(out, 'utf8')).toBe('png');
    expect(browser.close).toHaveBeenCalledOnce();
  });

  it('closes the browser when a page fails', async () => {
    page.setContent.mockRejectedValueOnce(new Error('boom'));

    await expect(
      renderOgImages([{ html: '', out: join(tmp(), 'x.png') }]),
    ).rejects.toThrow('boom');
    expect(browser.close).toHaveBeenCalledOnce();
  });
});
