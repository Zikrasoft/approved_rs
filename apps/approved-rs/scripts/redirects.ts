import { readFileSync, writeFileSync } from 'node:fs';
import { withRedirects } from '@podbor/site-kit/redirects';
import { EDGE_REDIRECTS } from '../src/redirects.ts';

const file = new URL('../vercel.json', import.meta.url);
writeFileSync(file, withRedirects(readFileSync(file, 'utf8'), EDGE_REDIRECTS));
