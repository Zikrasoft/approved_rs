import { z } from 'zod';

export const vehicleResponseSchema = z.object({
  id: z.string(),
  make: z.string(),
  model: z.string(),
  engine_code: z.string(),
  year_from: z.number().nullable(),
  year_to: z.number().nullable(),
});

export type VehicleResponse = z.infer<typeof vehicleResponseSchema>;
