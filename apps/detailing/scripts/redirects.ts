import {
  unprefixedSectionRedirects,
  writeRedirects,
} from '@podbor/site-kit/redirects';
import { PRIMARY_LOCALE } from '../src/i18n/config.ts';
import { PathBuilder } from '../src/utils/paths.ts';

writeRedirects(
  new URL('../vercel.json', import.meta.url),
  unprefixedSectionRedirects(PathBuilder, PRIMARY_LOCALE),
);
