import type { MedusaRequest } from '@medusajs/framework/http';
import type { Context, MedusaContainer } from '@medusajs/framework/types';
import { MedusaError } from '@medusajs/framework/utils';
import {
  normalizePartNumber,
  vehicleName,
  vinSchema,
  type Vehicle,
} from '@podbor/catalog-contract';

import { CATALOG_MODULE, WORKSHOP_QUOTE_SOURCE } from '../modules/catalog';
import type CatalogModuleService from '../modules/catalog/service';
import type { Provenance } from '../modules/catalog/service';
import { VIN_LOOKUP_MODULE } from '../modules/vin-lookup';
import { adminError } from '../modules/_shared/admin-error';
import { slugOf } from '../modules/_shared/slug';
import { nameKey } from '../modules/_shared/keys';
import { shopAi, type CategoryChoice } from './ai';
import { type QuoteDraftLine, quoteLineResolver } from './quote-line';
import { listVehicleResponses } from './store-response';
import { engineLessVehicle } from './suppliers/vehicles';
import { readCapped, uploadType } from './uploads';
import { generationOf, type VinGeneration } from './vin/car-for';
import { vinDecoders } from './vin/chain';
import { resolveVin } from './vin/resolve';

export const MAX_QUOTE_BYTES = 10 * 1024 * 1024;

const PDF_TYPE = 'application/pdf';
const PDF_SIGNATURE = '%PDF-';

export type QuoteDraft = {
  vin: string | null;
  vehicle_text: string | null;
  vehicle: Vehicle | null;
  generation: string | null;
  candidates: Vehicle[];
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

const generationLabel = (
  generation: VinGeneration | null,
  candidates: Vehicle[],
): string | null => {
  if (generation?.model) {
    return [generation.model, generation.chassis ?? generation.code]
      .filter(Boolean)
      .join(' ');
  }
  const [first] = candidates;
  if (
    first &&
    candidates.every(({ model }) => model.slug === first.model.slug)
  ) {
    return vehicleName(first.model).full;
  }
  return generation && (generation.model_slug ?? generation.code);
};

async function quoteVehicle(
  scope: MedusaContainer,
  typed: string | null,
): Promise<Pick<QuoteDraft, 'vehicle' | 'generation' | 'candidates'>> {
  const vin = vinSchema.safeParse(typed);
  if (!vin.success) return { vehicle: null, generation: null, candidates: [] };
  const catalog: CatalogModuleService = scope.resolve(CATALOG_MODULE);
  const lookup = await resolveVin(
    vin.data,
    vinDecoders(scope),
    { catalog, vinLookups: scope.resolve(VIN_LOOKUP_MODULE) },
    { source: 'workshop-quote' },
  );
  if (lookup.resolved) {
    return { vehicle: lookup.vehicle, generation: null, candidates: [] };
  }
  const candidates = lookup.vehicle_ids.length
    ? await listVehicleResponses(catalog, { id: lookup.vehicle_ids })
    : [];
  return {
    vehicle: null,
    generation: generationLabel(generationOf(lookup), candidates),
    candidates,
  };
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

type PickedVehicle = {
  id: string;
  model_id: string;
  year_from: number | null;
  year_to: number | null;
};

const isYear = (year: number | null): year is number => year !== null;

const yearsSpanning = (vehicles: PickedVehicle[]) => {
  const from = vehicles.map(({ year_from }) => year_from);
  const to = vehicles.map(({ year_to }) => year_to);
  return {
    year_from: from.every(isYear) ? Math.min(...from) : null,
    year_to: to.every(isYear) ? Math.max(...to) : null,
  };
};

async function generationVehicles(
  catalog: CatalogModuleService,
  picked: PickedVehicle[],
  provenance: Provenance,
  context: Context,
): Promise<string[]> {
  const byModel = new Map<string, PickedVehicle[]>();
  for (const vehicle of picked) {
    byModel.set(vehicle.model_id, [
      ...(byModel.get(vehicle.model_id) ?? []),
      vehicle,
    ]);
  }
  const ids: string[] = [];
  for (const [modelId, vehicles] of byModel) {
    ids.push(
      await engineLessVehicle(
        catalog,
        {
          model_id: modelId,
          power_kw: null,
          ...yearsSpanning(vehicles),
          ...provenance,
          source: WORKSHOP_QUOTE_SOURCE,
        },
        context,
      ),
    );
  }
  return ids;
}

const quotePartName = (line: WorkshopQuoteLine, brand: string) => {
  const number = normalizePartNumber(line.number);
  return number && normalizePartNumber(line.name)?.includes(number)
    ? line.name
    : [line.name, brand, line.number].join(' ');
};

const createFromWorkshopQuote = (
  catalog: CatalogModuleService,
  lines: WorkshopQuoteLine[],
  { picked, generation }: { picked: PickedVehicle[]; generation: boolean },
  provenance: Provenance,
): Promise<WorkshopQuoteResult & { vehicle_ids: string[] }> =>
  catalog.transaction(async (context) => {
    const vehicleIds = generation
      ? await generationVehicles(catalog, picked, provenance, context)
      : picked.map(({ id }) => id);
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
            name: quotePartName(
              line,
              brands.find(({ id }) => id === brandId)?.name ?? line.brand,
            ),
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
      for (const vehicleId of vehicleIds) {
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
    return { ...result, vehicle_ids: vehicleIds };
  });

export type ConfirmedQuote = WorkshopQuoteResult & { vehicles: Vehicle[] };

export async function confirmQuote(
  scope: MedusaContainer,
  {
    vehicle_ids,
    generation,
    lines,
  }: {
    vehicle_ids: string[];
    generation: boolean;
    lines: WorkshopQuoteLine[];
  },
  editor: { created_by: string; updated_by: string },
): Promise<ConfirmedQuote> {
  const catalog: CatalogModuleService = scope.resolve(CATALOG_MODULE);
  const ids = [...new Set(vehicle_ids)];
  const picked = ids.length
    ? await catalog.listVehicles(
        { id: ids },
        { select: ['id', 'model_id', 'year_from', 'year_to'], take: null },
      )
    : [];
  if (picked.length !== ids.length) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      'A Vehicle picked for the Workshop quote does not exist',
    );
  }
  const { vehicle_ids: fitted, ...created } = await createFromWorkshopQuote(
    catalog,
    lines,
    { picked, generation },
    editor,
  );
  const vehicles = fitted.length
    ? await listVehicleResponses(catalog, { id: fitted })
    : [];
  return { vehicles, ...created };
}

export async function draftQuote(
  scope: MedusaContainer,
  pdf: Buffer,
): Promise<QuoteDraft> {
  const catalog: CatalogModuleService = scope.resolve(CATALOG_MODULE);
  const categories: CategoryChoice[] = (
    await catalog.listCategories({}, { select: ['id', 'name'], take: null })
  ).map(({ id, name }) => ({ id, name }));
  const brands = (
    await catalog.listBrands({}, { select: ['name'], take: null })
  ).map(({ name }) => name);

  const reading = await shopAi(scope).readQuote(pdf, categories, brands);

  const resolveLine = quoteLineResolver(catalog, categories);
  const lines: QuoteDraftLine[] = [];
  for (const line of reading.lines) lines.push(await resolveLine(line));

  return {
    vin: reading.vin,
    vehicle_text: reading.vehicle,
    ...(await quoteVehicle(scope, reading.vin)),
    lines,
  };
}
