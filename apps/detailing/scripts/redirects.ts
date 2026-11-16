import {
  unprefixedSectionRedirects,
  writeCaddySiteConfig,
  writeVercelConfig,
} from '@podbor/site-kit/redirects';
import { PRIMARY_LOCALE } from '../src/i18n/config.ts';
import { PathBuilder } from '../src/utils/paths.ts';

const redirects = unprefixedSectionRedirects(PathBuilder, PRIMARY_LOCALE);

writeVercelConfig(new URL('../vercel.json', import.meta.url), redirects);
writeCaddySiteConfig(
  new URL(
    '../../../infra/auto-service-shop/caddy/sites/detailing.caddy',
    import.meta.url,
  ),
  redirects,
);
