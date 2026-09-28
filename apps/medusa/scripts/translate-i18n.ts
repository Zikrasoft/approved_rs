import { createSectionTranslator, type Section } from '@podbor/i18n/translate';

import { emailsContentSchema } from '../src/lib/emails-schema.ts';
import {
  BUSINESS_DESCRIPTION,
  TARGET_LANGUAGE_NAME,
  TARGET_LOCALES,
} from '../src/lib/translate-config.ts';

export const SECTIONS: readonly Section[] = [
  {
    path: 'src/content/i18n/emails.yaml',
    fields: emailsContentSchema.keyof().options,
    schema: emailsContentSchema,
    promptSubject:
      'the order confirmation email of a car parts shop (the order is picked up and paid for at the workshop)',
  },
];

const { run } = createSectionTranslator({
  targetLocales: TARGET_LOCALES,
  languageName: TARGET_LANGUAGE_NAME,
  businessDescription: BUSINESS_DESCRIPTION,
});

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(await run(SECTIONS));
}
