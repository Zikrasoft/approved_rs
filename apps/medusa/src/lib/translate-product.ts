import type { MedusaContainer } from '@medusajs/framework/types';
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from '@medusajs/framework/utils';
import { batchTranslationsWorkflow } from '@medusajs/medusa/core-flows';
import { translateFields } from '@podbor/i18n/translate/core';
import { MEDUSA_LOCALE } from '@podbor/shop-catalog';
import { z } from 'zod';

import { parseEnv } from './env';
import { updateProductMetadata } from './metadata';
import {
  productSource,
  sourceHash,
  translatedFromKey,
  translationStamps,
} from './product-source';
import { selectOne } from './query';
import {
  BUSINESS_DESCRIPTION,
  PRODUCT_PROMPT_SUBJECT,
  TARGET_LANGUAGE_NAME,
  TARGET_LOCALES,
  type TargetLocale,
} from './translate-config';

export type TranslateOutcome =
  'missing' | 'current' | 'no-key' | 'translated' | 'failed';

export const sourceRowSchema = z.object({
  id: z.string(),
  title: z.string().nullish(),
  subtitle: z.string().nullish(),
  description: z.string().nullish(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
});

export type SourceRow = z.infer<typeof sourceRowSchema>;

export function staleLocales(product: SourceRow): TargetLocale[] {
  const hash = sourceHash(productSource(product));
  return TARGET_LOCALES.filter(
    (locale) => product.metadata?.[translatedFromKey(locale)] !== hash,
  );
}

export const isCurrent = (product: SourceRow): boolean =>
  staleLocales(product).length === 0;

export async function translateProduct(
  container: MedusaContainer,
  id: string,
): Promise<TranslateOutcome> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const product = await selectOne(query, 'product', sourceRowSchema, { id });
  if (!product) {
    return 'missing';
  }
  const stale = staleLocales(product);
  if (!stale.length) {
    return 'current';
  }
  const apiKey = parseEnv(process.env).OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn(`Product ${id} is not translated: OPENAI_API_KEY is not set`);
    return 'no-key';
  }

  const source = productSource(product);
  const translation = container.resolve(Modules.TRANSLATION);
  const done: TargetLocale[] = [];

  for (const locale of stale) {
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
      done.push(locale);
    } catch (error) {
      logger.error(
        `Product ${id} was not translated into ${locale}: ${String(error)}`,
      );
    }
  }

  if (!done.length) {
    return 'failed';
  }
  try {
    await updateProductMetadata(container, id, translationStamps(source, done));
  } catch (error) {
    if (
      error instanceof MedusaError &&
      error.type === MedusaError.Types.NOT_FOUND
    ) {
      logger.warn(`Product ${id} was deleted while it was being translated`);
      return 'missing';
    }
    throw error;
  }
  logger.info(`Product ${id} translated into ${done.join(', ')}`);
  return done.length === stale.length ? 'translated' : 'failed';
}
