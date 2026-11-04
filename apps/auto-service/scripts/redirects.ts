import {
  unprefixedSectionRedirects,
  writeVercelConfig,
} from '@podbor/site-kit/redirects';
import { PRIMARY_LOCALE } from '../src/i18n/config.ts';
import {
  categoryCaseRedirects,
  siteRedirects,
} from '../src/utils/legacyCategories.ts';
import { PathBuilder } from '../src/utils/paths.ts';

writeVercelConfig(new URL('../vercel.json', import.meta.url), [
  ...siteRedirects(),
  ...categoryCaseRedirects(),
  ...unprefixedSectionRedirects(PathBuilder, PRIMARY_LOCALE),
]);
