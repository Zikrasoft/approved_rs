import { z } from 'zod';
import type { FitmentEntry } from './fitment.ts';

const name = z.string().trim().min(1);
const year = z.number().int().min(1950).max(2100);

export const vehicleTreeSchema = z
  .object({
    makes: z.array(
      z
        .object({
          name,
          models: z.array(
            z
              .object({
                name,
                generations: z.array(
                  z.object({ name, yearFrom: year, yearTo: year }).strict(),
                ),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
  })
  .strict();

export type VehicleTreeResponse = z.infer<typeof vehicleTreeSchema>;

export const vehicleFitment = (tree: VehicleTreeResponse): FitmentEntry[] =>
  tree.makes.flatMap((make) =>
    make.models.flatMap((model) =>
      model.generations.map((generation) => ({
        make: make.name,
        model: model.name,
        yearFrom: generation.yearFrom,
        yearTo: generation.yearTo,
      })),
    ),
  );
