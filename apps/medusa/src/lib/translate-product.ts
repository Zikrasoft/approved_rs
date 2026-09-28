import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { batchTranslationsWorkflow } from '@medusajs/medusa/core-flows';
import { translateFields } from '@podbor/i18n/translate/core';
import { MEDUSA_LOCALE } from '@podbor/shop-catalog';

import { parseEnv } from './env';
import { updateProductMetadata } from './metadata';
import { TRANSLATED_FROM, productSource, sourceHash } from './product-source';
import { queryOne } from './query';
import {
  BUSINESS_DESCRIPTION,
  PRODUCT_PROMPT_SUBJECT,
  TARGET_LANGUAGE_NAME,
  TARGET_LOCALES,
} from './translate-config';

export type TranslateOutcome =
  'missing' | 'current' | 'no-key' | 'translated' | 'failed';

export type SourceRow = {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
};

export const SOURCE_ROW_FIELDS = [
  'id',
  'title',
  'subtitle',
  'description',
  'metadata',
];

export const isCurrent = (product: SourceRow): boolean =>
  product.metadata?.[TRANSLATED_FROM] === sourceHash(productSource(product));

export async function translateProduct(
  container: MedusaContainer,
  id: string,
): Promise<TranslateOutcome> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const product = await queryOne<SourceRow>(
    query,
    'product',
    SOURCE_ROW_FIELDS,
    { id },
  );
  if (!product) {
    return 'missing';
  }
  if (isCurrent(product)) {
    return 'current';
  }
  const apiKey = parseEnv(process.env).OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn(`Product ${id} is not translated: OPENAI_API_KEY is not set`);
    return 'no-key';
  }

  const source = productSource(product);
  const translation = container.resolve(Modules.TRANSLATION);
  let failed = false;

  for (const locale of TARGET_LOCALES) {
    try {
      const translated = await translateFields({
        fields: source,
        targetLocales: [locale],
        languageName: TARGET_LANGUAGE_NAME,
        businessDescription: BUSINESS_DESCRIPTION,
        subject: PRODUCT_PROMPT_SUBJECT,
        apiKey,
      });
      const locale_code = MEDUSA_LOCALE[locale];
      const [existing] = await translation.listTranslations({
        reference: 'product',
        reference_id: id,
        locale_code,
      });
      await batchTranslationsWorkflow(container).run({
        input: existing
          ? {
              create: [],
              update: [{ id: existing.id, translations: translated[locale] }],
              delete: [],
            }
          : {
              create: [
                {
                  reference: 'product',
                  reference_id: id,
                  locale_code,
                  translations: translated[locale],
                },
              ],
              update: [],
              delete: [],
            },
      });
    } catch (error) {
      failed = true;
      logger.error(
        `Product ${id} was not translated into ${locale}: ${String(error)}`,
      );
    }
  }

  if (failed) {
    return 'failed';
  }
  await updateProductMetadata(container, id, {
    [TRANSLATED_FROM]: sourceHash(source),
  });
  logger.info(`Product ${id} translated into ${TARGET_LOCALES.join(', ')}`);
  return 'translated';
}
