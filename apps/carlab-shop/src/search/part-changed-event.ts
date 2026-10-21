import { z } from 'zod';

export const PART_CHANGED_EVENT = 'parts.part.changed';

export const partChangedEventSchema = z.object({ part_id: z.string() });
