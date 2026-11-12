import { MANUAL_SOURCE } from '../catalog/models/provenance';

export const CRAWLED_SUPPLIER_KEYS = [
  'mann-filter',
  'varta',
  'bilstein',
  'filtron',
] as const;

export const SUPPLIER_ADAPTER_NAMES = [
  'demo',
  ...CRAWLED_SUPPLIER_KEYS,
] as const;

export const DEMO_SUPPLIER_KEYS = [
  'demo-intercars',
  'demo-autodelovi',
] as const;

export const MANUAL_SUPPLIER_KEY = MANUAL_SOURCE;

export const SUPPLIER_KEYS = [
  ...CRAWLED_SUPPLIER_KEYS,
  ...DEMO_SUPPLIER_KEYS,
  MANUAL_SUPPLIER_KEY,
] as const;

export type SupplierAdapterName = (typeof SUPPLIER_ADAPTER_NAMES)[number];
export type CrawledSupplierKey = (typeof CRAWLED_SUPPLIER_KEYS)[number];
export type SupplierKey = (typeof SUPPLIER_KEYS)[number];
export type AdapterSupplierKey = Exclude<
  SupplierKey,
  typeof MANUAL_SUPPLIER_KEY
>;
