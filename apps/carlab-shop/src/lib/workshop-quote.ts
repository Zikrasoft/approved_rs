import type { MedusaRequest } from '@medusajs/framework/http';
import type { MedusaContainer } from '@medusajs/framework/types';
import { MedusaError } from '@medusajs/framework/utils';
import { vinSchema, type Vehicle } from '@podbor/catalog-contract';

import { CATALOG_MODULE } from '../modules/catalog';
import type CatalogModuleService from '../modules/catalog/service';
import type {
  WorkshopQuoteLine,
  WorkshopQuoteResult,
} from '../modules/catalog/service';
import { VIN_LOOKUP_MODULE } from '../modules/vin-lookup';
import { adminError } from './admin-errors';
import { shopAi, type CategoryChoice } from './ai';
import { readUpload, uploadType } from './uploads';
import { vinDecoders } from './vin/chain';
import { resolveVin } from './vin/resolve';

export const MAX_QUOTE_BYTES = 10 * 1024 * 1024;
export const CONFIDENT_BRAND = 0.8;

const PDF_TYPE = 'application/pdf';
const PDF_SIGNATURE = '%PDF-';

export type QuoteDraftLine = {
  name: string;
  number: string;
  quantity: number;
  brand: string | null;
  brand_confidence: number;
  brand_uncertain: boolean;
  category: CategoryChoice | null;
};

export type QuoteDraft = {
  vin: string | null;
  vehicle_text: string | null;
  vehicle: Vehicle | null;
  lines: QuoteDraftLine[];
};

const invalidQuote = (message: string) =>
  adminError(MedusaError.Types.INVALID_DATA, 'INVALID_QUOTE', message);

export async function readQuoteUpload(req: MedusaRequest): Promise<Buffer> {
  if (uploadType(req) !== PDF_TYPE) {
    throw invalidQuote('A Workshop quote is uploaded as a PDF');
  }
  const body = await readUpload(req, MAX_QUOTE_BYTES, () =>
    adminError(
      MedusaError.Types.INVALID_DATA,
      'QUOTE_TOO_LARGE',
      `Workshop quotes are limited to ${MAX_QUOTE_BYTES} bytes`,
    ),
  );
  if (body.subarray(0, PDF_SIGNATURE.length).toString() !== PDF_SIGNATURE) {
    throw invalidQuote('The file is not a PDF');
  }
  return body;
}

async function quoteVehicle(
  scope: MedusaContainer,
  vin: string | null,
): Promise<Vehicle | null> {
  const parsed = vinSchema.safeParse(vin);
  if (!parsed.success) return null;
  const lookup = await resolveVin(parsed.data, vinDecoders(scope), {
    catalog: scope.resolve(CATALOG_MODULE),
    vinLookups: scope.resolve(VIN_LOOKUP_MODULE),
  });
  return lookup.resolved ? lookup.vehicle : null;
}

export type ConfirmedQuote = WorkshopQuoteResult & { vehicle: Vehicle | null };

export async function confirmQuote(
  scope: MedusaContainer,
  { vin, lines }: { vin: string | null; lines: WorkshopQuoteLine[] },
  editor: { created_by: string; updated_by: string },
): Promise<ConfirmedQuote> {
  const vehicle = await quoteVehicle(scope, vin);
  const catalog: CatalogModuleService = scope.resolve(CATALOG_MODULE);
  const created = await catalog.createFromWorkshopQuote(
    lines,
    vehicle?.id ?? null,
    editor,
  );
  return { vehicle, ...created };
}

export async function draftQuote(
  scope: MedusaContainer,
  pdf: Buffer,
): Promise<QuoteDraft> {
  const catalog: CatalogModuleService = scope.resolve(CATALOG_MODULE);
  const categories: CategoryChoice[] = (
    await catalog.listCategories({}, { select: ['id', 'name'] })
  ).map(({ id, name }) => ({ id, name }));
  const byId = new Map(categories.map((category) => [category.id, category]));

  const reading = await shopAi(scope).readQuote(pdf, categories);

  return {
    vin: reading.vin,
    vehicle_text: reading.vehicle,
    vehicle: await quoteVehicle(scope, reading.vin),
    lines: reading.lines.map((line) => ({
      name: line.name,
      number: line.number,
      quantity: line.quantity,
      brand: line.brand,
      brand_confidence: line.brand_confidence,
      brand_uncertain: !line.brand || line.brand_confidence < CONFIDENT_BRAND,
      category: (line.category_id && byId.get(line.category_id)) || null,
    })),
  };
}
