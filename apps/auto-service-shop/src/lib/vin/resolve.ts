import type { Vehicle, VinLookupResponse } from '@podbor/catalog-contract';
import { vinFactsSchema } from '@podbor/catalog-contract';

import type CatalogModuleService from '../../modules/catalog/service';
import type VinLookupModuleService from '../../modules/vin-lookup/service';
import { listVehicleResponses } from '../store-response';
import { modelsListingBaumuster } from './crawled-baumuster';
import type { VinDecode, VinDecoder } from './decoder';

type Answer = { decoder: VinDecoder; decode: VinDecode };

type Services = {
  catalog: CatalogModuleService;
  vinLookups: VinLookupModuleService;
};

const vehicleById = async (
  catalog: CatalogModuleService,
  id: string,
): Promise<Vehicle | null> =>
  (await listVehicleResponses(catalog, { id }))[0] ?? null;

const identifiedVehicle = async (
  catalog: CatalogModuleService,
  identifiers: VinDecode['identifiers'],
): Promise<Vehicle[]> => {
  if (!identifiers.length) return [];
  const [match] = await catalog.listVehicleIdentifiers({ $or: identifiers });
  const vehicle = match && (await vehicleById(catalog, match.vehicle_id));
  return vehicle ? [vehicle] : [];
};

const crawledVehicles = async (
  catalog: CatalogModuleService,
  { make, identifiers }: VinDecode,
): Promise<Vehicle[]> => {
  const baumuster = identifiers.find(
    ({ type }) => type === 'mercedes-baumuster',
  );
  if (!baumuster) return [];
  const modelIds = await modelsListingBaumuster(catalog, make, baumuster.value);
  return modelIds.length
    ? listVehicleResponses(catalog, { model_id: modelIds })
    : [];
};

const vehiclesFor = async (
  catalog: CatalogModuleService,
  decode: VinDecode,
): Promise<Vehicle[]> => {
  const identified = await identifiedVehicle(catalog, decode.identifiers);
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
): Promise<VinLookupResponse> => {
  const [existing] = await vinLookups.listVinLookups({ vin });
  const current = decoders.some(
    ({ name, version }) =>
      name === existing?.decoder && version === existing?.decoder_version,
  );
  if (existing?.vehicle_id && current) {
    const vehicle = await vehicleById(catalog, existing.vehicle_id);
    if (vehicle) {
      return {
        resolved: true,
        vehicle,
        facts: vinFactsSchema.parse(existing.facts),
      };
    }
  }

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
