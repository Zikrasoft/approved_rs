import type {
  Vehicle,
  VehicleIdentifierType,
  VinLookupResponse,
} from '@podbor/catalog-contract';

import type CatalogModuleService from '../../modules/catalog/service';
import type VinLookupModuleService from '../../modules/vin-lookup/service';
import { listVehicleResponses } from '../store-response';
import { vehiclesDescribedByTypeKey } from './bmw-type-key';
import { modelsListingBaumuster } from './crawled-baumuster';
import type { VinDecode, VinDecoder } from './decoder';

type Answer = { decoder: VinDecoder; decode: VinDecode };

type Services = {
  catalog: CatalogModuleService;
  vinLookups: VinLookupModuleService;
};

type CrawledMatch = (
  catalog: CatalogModuleService,
  make: string,
  value: string,
) => Promise<Vehicle[]>;

const identifiedVehicles = async (
  catalog: CatalogModuleService,
  identifiers: VinDecode['identifiers'],
): Promise<Vehicle[]> => {
  if (!identifiers.length) return [];
  const ids = (
    await catalog.listVehicleIdentifiers(
      { $or: identifiers },
      { select: ['vehicle_id'], take: null },
    )
  ).map(({ vehicle_id }) => vehicle_id);
  return ids.length
    ? listVehicleResponses(catalog, { id: [...new Set(ids)] })
    : [];
};

const vehiclesListingBaumuster: CrawledMatch = async (
  catalog,
  make,
  baumuster,
) => {
  const modelIds = await modelsListingBaumuster(catalog, make, baumuster);
  return modelIds.length
    ? listVehicleResponses(catalog, { model_id: modelIds })
    : [];
};

const CRAWLED_MATCHES: Partial<Record<VehicleIdentifierType, CrawledMatch>> = {
  'mercedes-baumuster': vehiclesListingBaumuster,
  'bmw-type-code': vehiclesDescribedByTypeKey,
};

const crawledVehicles = async (
  catalog: CatalogModuleService,
  { make, identifiers: [identifier] }: VinDecode,
): Promise<Vehicle[]> => {
  const match = identifier && CRAWLED_MATCHES[identifier.type];
  return match ? match(catalog, make, identifier.value) : [];
};

const vehiclesFor = async (
  catalog: CatalogModuleService,
  decode: VinDecode,
): Promise<Vehicle[]> => {
  const identified = await identifiedVehicles(catalog, decode.identifiers);
  return identified.length ? identified : crawledVehicles(catalog, decode);
};

const decodeThroughChain = async (
  vin: string,
  decoders: VinDecoder[],
  catalog: CatalogModuleService,
): Promise<{ answer: Answer | null; vehicles: Vehicle[] }> => {
  let first: Answer | null = null;
  for (const decoder of decoders) {
    const decode = await decoder.decode(vin);
    if (!decode) continue;
    first ??= { decoder, decode };
    const vehicles = await vehiclesFor(catalog, decode);
    if (vehicles.length) return { answer: { decoder, decode }, vehicles };
  }
  return { answer: first, vehicles: [] };
};

const commonModelSlug = (vehicles: Vehicle[]): string | null => {
  const slugs = new Set(vehicles.map(({ model }) => model.slug));
  return slugs.size === 1 ? [...slugs][0] : null;
};

export const resolveVin = async (
  vin: string,
  decoders: VinDecoder[],
  { catalog, vinLookups }: Services,
): Promise<
  | Omit<Extract<VinLookupResponse, { resolved: true }>, 'place'>
  | Omit<Extract<VinLookupResponse, { resolved: false }>, 'place'>
> => {
  const [existing] = await vinLookups.listVinLookups({ vin });
  const { answer, vehicles } = await decodeThroughChain(vin, decoders, catalog);
  const vehicle = vehicles.length === 1 ? vehicles[0] : null;
  const record = {
    vin,
    decoder: answer?.decoder.name ?? null,
    decoder_version: answer?.decoder.version ?? null,
    raw: answer?.decode.raw ?? null,
    facts: answer?.decode.facts ?? {},
    make: answer?.decode.make ?? null,
    code: answer?.decode.code ?? answer?.decode.identifiers[0]?.value ?? null,
    vehicle_id: vehicle?.id ?? null,
  };
  if (existing) {
    await vinLookups.updateVinLookups({ id: existing.id, ...record });
  } else {
    await vinLookups.createVinLookups(record);
  }

  return vehicle
    ? { resolved: true, vehicle, facts: record.facts }
    : {
        resolved: false,
        make: record.make,
        code: record.code,
        model_slug: commonModelSlug(vehicles),
        vehicle_ids: vehicles.map(({ id }) => id),
      };
};
