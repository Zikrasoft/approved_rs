import { z } from 'zod';

const vehicleSchema = z.object({
  id: z.string(),
  make: z.string(),
  model: z.string(),
  engine_code: z.string(),
  year_from: z.number().nullable(),
  year_to: z.number().nullable(),
});

const candidateSchema = z.object({
  fitment_id: z.string(),
  production_from: z.string().nullable(),
  production_to: z.string().nullable(),
  steering: z.enum(['left', 'right']).nullable(),
  gearbox: z.enum(['manual', 'automatic']).nullable(),
});

const vehiclePartSchema = z.object({
  part: z.object({ id: z.string(), name: z.string() }),
  ambiguous: z.boolean(),
  candidates: z.array(candidateSchema),
});

export type Vehicle = z.infer<typeof vehicleSchema>;
export type VehicleFitmentCandidate = z.infer<typeof candidateSchema>;
export type VehiclePart = z.infer<typeof vehiclePartSchema>;

type BackendConfig = { backendUrl: string; publishableKey: string };

export async function fetchVehicles({
  backendUrl,
  publishableKey,
}: BackendConfig): Promise<Vehicle[]> {
  const response = await fetch(`${backendUrl}/store/vehicles`, {
    headers: { 'x-publishable-api-key': publishableKey },
  });

  if (!response.ok) {
    return [];
  }

  const body = await response.json();
  return z.array(vehicleSchema).parse(body.vehicles);
}

export async function fetchVehicleParts(
  vehicleId: string,
  { backendUrl, publishableKey }: BackendConfig,
): Promise<VehiclePart[] | null> {
  const response = await fetch(
    `${backendUrl}/store/vehicles/${vehicleId}/parts`,
    { headers: { 'x-publishable-api-key': publishableKey } },
  );

  if (!response.ok) {
    return null;
  }

  const body = await response.json();
  return z.array(vehiclePartSchema).parse(body.parts);
}

const uniqueSorted = (values: string[]): string[] =>
  [...new Set(values)].sort((a, b) => a.localeCompare(b));

export function listMakes(vehicles: Vehicle[]): string[] {
  return uniqueSorted(vehicles.map((vehicle) => vehicle.make));
}

export function listModels(vehicles: Vehicle[], make: string): string[] {
  return uniqueSorted(
    vehicles.filter((vehicle) => vehicle.make === make).map((v) => v.model),
  );
}

export function listEngines(
  vehicles: Vehicle[],
  make: string,
  model: string,
): string[] {
  return uniqueSorted(
    vehicles
      .filter((vehicle) => vehicle.make === make && vehicle.model === model)
      .map((v) => v.engine_code),
  );
}

export function findVehicle(
  vehicles: Vehicle[],
  make: string,
  model: string,
  engineCode: string,
): Vehicle | null {
  return (
    vehicles.find(
      (vehicle) =>
        vehicle.make === make &&
        vehicle.model === model &&
        vehicle.engine_code === engineCode,
    ) ?? null
  );
}
