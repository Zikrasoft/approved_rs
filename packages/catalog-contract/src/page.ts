import { z } from 'zod';

export const pageFields = {
  count: z.number().int().nonnegative().nullable().default(null),
  offset: z.number().int().nonnegative().nullable().default(null),
  limit: z.number().int().positive().nullable().default(null),
  next: z.string().nullable().default(null),
};
