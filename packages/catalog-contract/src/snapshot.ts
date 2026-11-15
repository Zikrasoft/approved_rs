import { z } from 'zod';
import { categorySchema } from './categories.ts';
import { fitmentSchema } from './fitment.ts';
import { partPageSchema } from './partPages.ts';
import { vehicleSchema } from './vehicle.ts';

export const CATALOGUE_SNAPSHOT_PATH = '/store/catalogue-snapshot';

export const catalogueSnapshotResponseSchema = z.object({
  categories: z.array(categorySchema),
  pages: z.array(partPageSchema),
  fitments: z.array(fitmentSchema),
  vehicles: z.array(vehicleSchema),
});

export type CatalogueSnapshotResponse = z.infer<
  typeof catalogueSnapshotResponseSchema
>;
