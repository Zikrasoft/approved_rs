import type { MedusaRequest } from '@medusajs/framework/http';
import type { Context, MedusaContainer } from '@medusajs/framework/types';
import { MedusaError } from '@medusajs/framework/utils';
import type { Vehicle } from '@podbor/catalog-contract';

import { CATALOG_MODULE, WORKSHOP_QUOTE_SOURCE } from '../modules/catalog';
import type CatalogModuleService from '../modules/catalog/service';
import type { Provenance } from '../modules/catalog/service';
import { VIN_LOOKUP_MODULE } from '../modules/vin-lookup';
import { adminError } from '../modules/_shared/admin-error';
import { slugOf } from '../modules/_shared/slug';
import { nameKey } from '../modules/_shared/keys';
import { shopAi, type CategoryChoice } from './ai';
import { readCapped, uploadType } from './uploads';
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
  const body = await readCapped(req, MAX_QUOTE_BYTES, () =>
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
  if (!vin) return null;
  const lookup = await resolveVin(vin, vinDecoders(scope), {
    catalog: scope.resolve(CATALOG_MODULE),
    vinLookups: scope.resolve(VIN_LOOKUP_MODULE),
  });
  return lookup.resolved ? lookup.vehicle : null;
}

export type WorkshopQuoteLine = {
  name: string;
  number: string;
  quantity: number;
  brand: string;
  category_id: string | null;
};

export type WorkshopQuoteResult = {
  lines: { part_id: string; reused: boolean }[];
  fitments: number;
};

type QuoteBrand = {
  id: string;
  name: string;
  slug: string;
  spellings: { value_key: string }[];
};

async function quoteBrand(
  catalog: CatalogModuleService,
  name: string,
  brands: QuoteBrand[],
  provenance: Provenance,
  context: Context,
): Promise<string> {
  const key = nameKey(name);
  const slug = slugOf(name);
  const known = brands.find(
    (brand) =>
      nameKey(brand.name) === key ||
      brand.slug === slug ||
      brand.spellings.some(({ value_key }) => value_key === key),
  );
  if (known) return known.id;
  if (!slug) {
    throw adminError(
      MedusaError.Types.INVALID_DATA,
      'INVALID_BRAND',
      `Brand ${name} has no Latin letters for its slug`,
    );
  }
  const created = await catalog.createBrands(
    { name: name.trim(), ...provenance },
    context,
  );
  brands.push({ ...created, spellings: [] });
  return created.id;
}

async function quoteCategory(
  catalog: CatalogModuleService,
  categoryId: string | null,
  context: Context,
): Promise<string | null> {
  if (!categoryId) return null;
  const fields = await catalog.categoryDefinition(categoryId, context);
  return fields.some(({ required }) => required) ? null : categoryId;
}

const createFromWorkshopQuote = (
  catalog: CatalogModuleService,
  lines: WorkshopQuoteLine[],
  vehicleId: string | null,
  provenance: Provenance,
): Promise<WorkshopQuoteResult> =>
  catalog.transaction(async (context) => {
    const brands = await catalog.listBrands(
      {},
      { relations: ['spellings'], take: null },
      context,
    );
    const result: WorkshopQuoteResult = { lines: [], fitments: 0 };
    for (const line of lines) {
      const brandId = await quoteBrand(
        catalog,
        line.brand,
        brands,
        provenance,
        context,
      );
      const { part_id: partId, created: newPart } =
        await catalog.findOrCreatePart(
          {
            name: line.name,
            identifier: {
              type: 'manufacturer-number',
              brand_id: brandId,
              value: line.number,
            },
            category_id: await quoteCategory(
              catalog,
              line.category_id,
              context,
            ),
            ...provenance,
            source: WORKSHOP_QUOTE_SOURCE,
          },
          context,
        );
      if (vehicleId) {
        const { created } = await catalog.attachPartToVehicles(
          partId,
          { vehicle_id: vehicleId },
          { quantity: line.quantity, ...provenance },
          context,
        );
        result.fitments += created.length;
      }
      result.lines.push({ part_id: partId, reused: !newPart });
    }
    return result;
  });

export type ConfirmedQuote = WorkshopQuoteResult & { vehicle: Vehicle | null };

export async function confirmQuote(
  scope: MedusaContainer,
  { vin, lines }: { vin: string | null; lines: WorkshopQuoteLine[] },
  editor: { created_by: string; updated_by: string },
): Promise<ConfirmedQuote> {
  const vehicle = await quoteVehicle(scope, vin);
  const catalog: CatalogModuleService = scope.resolve(CATALOG_MODULE);
  const created = await createFromWorkshopQuote(
    catalog,
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
    await catalog.listCategories({}, { select: ['id', 'name'], take: null })
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
