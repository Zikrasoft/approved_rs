import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { crossReferenceSchema } from '@podbor/catalog-contract';
import { z } from 'zod';

import { crawledSupplierAdapter } from '../crawler/adapter';
import { enabledCrawledSites } from '../crawler/sites';
import { crawlStore } from '../crawler/store';
import { parseEnv } from '../env';
import { demoAdapters } from './demo-adapter';

export const SUPPLIER_ADAPTERS_REGISTRATION = 'supplierAdapters';

export const supplierArticleSchema = z.object({
  article_id: z.string().min(1),
  brand: z.string(),
  number: z.string(),
  name: z.string().trim().min(1),
  category: z.string(),
  description: z.string().trim().min(1).optional(),
  specs: z.record(z.string(), z.string()).optional(),
  cross_references: z.array(crossReferenceSchema).optional(),
  applicability: z.array(z.string()).optional(),
  images: z.array(z.url()).optional(),
});

export const cataloguePageSchema = z.object({
  articles: z.array(supplierArticleSchema),
  next: z.string().nullable(),
});

export const supplierQuoteSchema = z.object({
  article_id: z.string(),
  cost_price: z.number().nonnegative(),
  currency: z.string().length(3),
  stock: z.array(
    z.object({
      location: z.string(),
      quantity: z.number().int().nonnegative(),
    }),
  ),
  lead_time_days: z.number().int().nonnegative(),
});

export type SupplierArticle = z.input<typeof supplierArticleSchema>;
export type CataloguePage = z.input<typeof cataloguePageSchema>;
export type SupplierQuote = z.input<typeof supplierQuoteSchema>;

export type SupplierAdapter = {
  name: string;
  listCatalogue: (cursor: string | null) => Promise<CataloguePage>;
  quote: (articleIds: string[]) => Promise<SupplierQuote[]>;
};

const configuredAdapters = (scope: MedusaContainer): SupplierAdapter[] => {
  const env = parseEnv(process.env);
  const crawled = enabledCrawledSites().map((site) =>
    crawledSupplierAdapter(
      site,
      crawlStore(scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)),
    ),
  );
  return [
    ...(env.SUPPLIER_ADAPTERS.includes('demo')
      ? demoAdapters(env.DEMO_SUPPLIER_OVERRIDES, env.FILE_URL)
      : []),
    ...crawled,
  ];
};

export const supplierAdapters = (scope: MedusaContainer): SupplierAdapter[] =>
  scope.hasRegistration(SUPPLIER_ADAPTERS_REGISTRATION)
    ? scope.resolve<SupplierAdapter[]>(SUPPLIER_ADAPTERS_REGISTRATION)
    : configuredAdapters(scope);
