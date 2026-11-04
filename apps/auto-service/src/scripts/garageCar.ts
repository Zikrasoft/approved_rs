import { storedVin } from '@podbor/site-kit/browser';
import { readStoredJson, writeStoredJson } from '@podbor/site-kit/stored-value';
import * as z from 'zod/mini';

const GARAGE_CAR_KEY = 'my_garage_car';

const garageCarSchema = z.object({
  vin: z.string(),
  car: z.string(),
  make: z.optional(z.string()),
  model: z.optional(z.string()),
});

export type GarageCar = z.infer<typeof garageCarSchema>;

export const rememberCar = (car: GarageCar): void =>
  void writeStoredJson(GARAGE_CAR_KEY, car);

export function rememberedCar(): GarageCar | null {
  const remembered = readStoredJson(GARAGE_CAR_KEY, garageCarSchema, null);
  const vin = storedVin();
  return remembered && vin && remembered.vin === vin ? remembered : null;
}
