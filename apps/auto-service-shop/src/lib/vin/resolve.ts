import type { Vehicle, VinLookupResponse } from '@podbor/catalog-contract';
import { vinFactsSchema } from '@podbor/catalog-contract';

import type CatalogModuleService from '../../modules/catalog/service';
import type VinLookupModuleService from '../../modules/vin-lookup/service';
import { listVehicleResponses } from '../store-response';
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

const vehicleFor = async (
  catalog: CatalogModuleService,
  { identifiers }: VinDecode,
): Promise<Vehicle | null> => {
  if (!identifiers.length) return null;
  const [match] = await catalog.listVehicleIdentifiers({ $or: identifiers });
  return match ? vehicleById(catalog, match.vehicle_id) : null;
};

const decodeThroughChain = async (
  vin: string,
  decoders: VinDecoder[],
  catalog: CatalogModuleService,
): Promise<{ answer: Answer | null; vehicle: Vehicle | null }> => {
  let first: Answer | null = null;
  for (const decoder of decoders) {
    const decode = await decoder.decode(vin);
    if (!decode) continue;
    first ??= { decoder, decode };
    const vehicle = await vehicleFor(catalog, decode);
    if (vehicle) return { answer: { decoder, decode }, vehicle };
  }
  return { answer: first, vehicle: null };
};

export const resolveVin = async (
  vin: string,
  decoders: VinDecoder[],
  { catalog, vinLookups }: Services,
): Promise<
  | Omit<Extract<VinLookupResponse, { resolved: true }>, 'pages'>
  | Extract<VinLookupResponse, { resolved: false }>
> => {
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

  const { answer, vehicle } = await decodeThroughChain(vin, decoders, catalog);
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
    : { resolved: false, make: record.make, code: record.code };
};
