import { createSectionTranslator } from '@podbor/i18n/translate';
import { TRANSLATABLE_LOCALES } from '../src/i18n/config.ts';
import {
  BUSINESS_DESCRIPTION,
  TARGET_LANGUAGE_NAME,
} from '../src/i18n/translateConfig.ts';
import { SECTIONS } from '../src/i18n/sections.ts';

const { run } = createSectionTranslator({
  targetLocales: TRANSLATABLE_LOCALES,
  languageName: TARGET_LANGUAGE_NAME,
  businessDescription: BUSINESS_DESCRIPTION,
});

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(await run(SECTIONS));
}
