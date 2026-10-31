import { writeVercelConfig } from '@podbor/site-kit/redirects';
import { EDGE_REDIRECTS } from '../src/redirects.ts';

writeVercelConfig(new URL('../vercel.json', import.meta.url), EDGE_REDIRECTS);
