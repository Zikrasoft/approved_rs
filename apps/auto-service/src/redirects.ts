import { unprefixedSectionRedirects } from '@podbor/site-kit/redirects';
import { PRIMARY_LOCALE } from './i18n/config.ts';
import { PathBuilder } from './utils/paths.ts';

export const REDIRECTS = unprefixedSectionRedirects(
  PathBuilder,
  PRIMARY_LOCALE,
);
