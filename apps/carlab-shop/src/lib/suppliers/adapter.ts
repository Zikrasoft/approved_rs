import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import {
  BODY_STYLES,
  crossReferenceSchema,
  ENGINE_FUELS,
} from '@podbor/catalog-contract';
import { z } from 'zod';

import { crawledSupplierAdapter } from '../crawler/adapter';
import { enabledCrawledSites } from '../crawler/sites';
import { crawlStore } from '../crawler/store';
import { parseEnv } from '../env';
import { shopStorage } from '../storage';
import { demoAdapters } from './demo-adapter';

export const SUPPLIER_ADAPTERS_REGISTRATION = 'supplierAdapters';

const yearSchema = z.number().int().min(1900).max(2100).nullable();

export const vehicleFactsSchema = z.object({
  make: z.string().trim().min(1),
  model: z.string().trim().min(1),
  variant: z.string().trim().min(1),
  chassis_codes: z.array(z.string().trim().min(1)),
  engine_codes: z.array(z.string().trim().min(1)),
  displacement_cc: z.number().int().positive().nullable(),
  power_kw: z.number().int().positive().nullable(),
  fuel: z.enum(ENGINE_FUELS).nullable(),
  body_style: z.enum(BODY_STYLES).nullable(),
  year_from: yearSchema,
  year_to: yearSchema,
  notes: z.array(z.string().trim().min(1)),
});

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
  vehicles: z.array(vehicleFactsSchema).optional(),
  images: z.array(z.url()).optional(),
});

const unreadablePageSchema = z.object({ url: z.string(), reason: z.string() });

export const cataloguePageSchema = z.object({
  articles: z.array(supplierArticleSchema),
  unreadable: z.array(unreadablePageSchema).default([]),
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
export type VehicleFacts = z.infer<typeof vehicleFactsSchema>;
export type CataloguePage = z.input<typeof cataloguePageSchema>;
export type UnreadablePage = z.infer<typeof unreadablePageSchema>;
export type SupplierQuote = z.input<typeof supplierQuoteSchema>;

export type SupplierAdapter = {
  name: string;
  listCatalogue: (cursor: string | null) => Promise<CataloguePage>;
  quote: (articleIds: string[]) => Promise<SupplierQuote[]>;
};

const configuredAdapters = (scope: MedusaContainer): SupplierAdapter[] => {
  const env = parseEnv(process.env);
  const sites = enabledCrawledSites();
  const store = sites.length
    ? crawlStore(
        scope.resolve(ContainerRegistrationKeys.PG_CONNECTION),
        shopStorage(scope)?.pages ?? null,
      )
    : null;
  const crawled = store
    ? sites.map((site) => crawledSupplierAdapter(site, store))
    : [];
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
