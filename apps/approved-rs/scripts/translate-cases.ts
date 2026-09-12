import { createCaseTranslator } from '@podbor/i18n/translate';
import { TRANSLATABLE_LOCALES } from '../src/i18n/config.ts';
import {
  BUSINESS_DESCRIPTION,
  TARGET_LANGUAGE_NAME,
} from '../src/i18n/translateConfig.ts';

export const CASE_DIRS = [
  'src/content/cases',
  'src/content/autoservice-cases',
  'src/content/detailing-cases',
];

const { run } = createCaseTranslator({
  targetLocales: TRANSLATABLE_LOCALES,
  languageName: TARGET_LANGUAGE_NAME,
  businessDescription: BUSINESS_DESCRIPTION,
  subject: 'car-sourcing case studies',
});

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(await run(CASE_DIRS));
}
