import { Parser } from 'htmlparser2';

export type SitemapEntry = { loc: string; imageTitles: string[] };

const CHUNK_BYTES = 64 * 1024;

export const sitemapLinks = (
  xml: Buffer,
  keep: (entry: SitemapEntry) => boolean = () => true,
) => {
  const pages: string[] = [];
  const sitemaps: string[] = [];
  const open: string[] = [];
  let text = '';
  let entry: SitemapEntry = { loc: '', imageTitles: [] };
  const parser = new Parser(
    {
      onopentag: (name) => {
        open.push(name);
        text = '';
        if (name === 'url') entry = { loc: '', imageTitles: [] };
      },
      ontext: (chunk) => {
        text += chunk;
      },
      onclosetag: (name) => {
        open.pop();
        const parent = open[open.length - 1];
        const value = text.trim();
        text = '';
        if (name === 'loc' && parent === 'url') entry.loc = value;
        if (name === 'loc' && parent === 'sitemap' && value) {
          sitemaps.push(value);
        }
        if (name === 'image:title') entry.imageTitles.push(value);
        if (name === 'url' && entry.loc && keep(entry)) pages.push(entry.loc);
      },
    },
    { xmlMode: true, decodeEntities: true },
  );
  const decoder = new TextDecoder();
  for (let at = 0; at < xml.length; at += CHUNK_BYTES) {
    parser.write(
      decoder.decode(xml.subarray(at, at + CHUNK_BYTES), { stream: true }),
    );
  }
  parser.end(decoder.decode());
  return { pages, sitemaps };
};
