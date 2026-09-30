import { z } from 'zod';

import { treeComplaint } from '../lib/vehicle-tree';
import fixture from './fixtures/vehicles.json';

const name = z.string().trim().min(1).max(60);
const year = z.number().int().min(1950).max(2100);
const source = z.url({ protocol: /^https$/ });

const generationSchema = z
  .object({ name, yearFrom: year, yearTo: year, source: source.optional() })
  .strict();

const modelSchema = z
  .object({
    name,
    source,
    generations: z.array(generationSchema).min(1),
  })
  .strict();

const makeSchema = z
  .object({ name, models: z.array(modelSchema).min(1) })
  .strict();

export const vehiclesSchema = z
  .array(makeSchema)
  .min(1)
  .superRefine((tree, ctx) => {
    const complaint = treeComplaint(tree);
    if (complaint) {
      ctx.addIssue({ code: 'custom', message: complaint });
    }
  });

export type VehicleFixture = z.infer<typeof vehiclesSchema>;

export const VEHICLES: VehicleFixture = vehiclesSchema.parse(fixture);
