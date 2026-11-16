import {
  writeCaddySiteConfig,
  writeVercelConfig,
} from '@podbor/site-kit/redirects';
import { EDGE_REDIRECTS } from '../src/redirects.ts';

writeVercelConfig(new URL('../vercel.json', import.meta.url), EDGE_REDIRECTS);
writeCaddySiteConfig(
  new URL(
    '../../../infra/auto-service-shop/caddy/sites/approved-rs.caddy',
    import.meta.url,
  ),
  EDGE_REDIRECTS,
);
