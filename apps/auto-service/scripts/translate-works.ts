import { createCaseTranslator } from '@podbor/i18n/translate';
import { TRANSLATABLE_LOCALES } from '../src/i18n/config.ts';
import {
  BUSINESS_DESCRIPTION,
  LOCALE_GUIDANCE,
  TARGET_LANGUAGE_NAME,
} from '../src/i18n/translateConfig.ts';

export const WORK_DIRS = ['src/content/works'];
export const ARTICLE_DIRS = ['src/content/articles'];

const translator = (subject: string, extraFields: string[]) =>
  createCaseTranslator({
    targetLocales: TRANSLATABLE_LOCALES,
    languageName: TARGET_LANGUAGE_NAME,
    businessDescription: BUSINESS_DESCRIPTION,
    localeGuidance: LOCALE_GUIDANCE,
    subject,
    extraFields,
  });

const works = translator('car repair write-ups and car part descriptions', [
  'car',
]);
const articles = translator('car repair and maintenance blog articles', [
  'lead',
  'faq',
]);

if (import.meta.url === `file://${process.argv[1]}`) {
  const failed =
    (await works.run(WORK_DIRS)) | (await articles.run(ARTICLE_DIRS));
  process.exit(failed);
}
