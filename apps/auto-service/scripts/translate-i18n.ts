import {
  createSectionTranslator,
  STRICT_PLACEHOLDER_RULE,
} from '@podbor/i18n/translate';
import { TRANSLATABLE_LOCALES } from '../src/i18n/config.ts';
import {
  BUSINESS_DESCRIPTION,
  LOCALE_GUIDANCE,
  TARGET_LANGUAGE_NAME,
} from '../src/i18n/translateConfig.ts';
import { SECTIONS } from '../src/i18n/sections.ts';

const { run } = createSectionTranslator({
  targetLocales: TRANSLATABLE_LOCALES,
  languageName: TARGET_LANGUAGE_NAME,
  businessDescription: BUSINESS_DESCRIPTION,
  localeGuidance: LOCALE_GUIDANCE,
  placeholderRule: STRICT_PLACEHOLDER_RULE,
});

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(await run(SECTIONS));
}
