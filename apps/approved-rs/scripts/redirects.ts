import { writeRedirects } from '@podbor/site-kit/redirects';
import { EDGE_REDIRECTS } from '../src/redirects.ts';

writeRedirects(new URL('../vercel.json', import.meta.url), EDGE_REDIRECTS);
