import { z } from 'zod';

export const PART_IDENTIFIER_INDEX = 'part_identifier';

export const PART_CHANGED_EVENT = 'parts.part.changed';

export const PART_IDENTIFIERS_DELETED_EVENT = 'parts.part_identifier.deleted';

export const partChangedEventSchema = z.object({
  part_ids: z.array(z.string()),
});

export const partIdentifiersDeletedEventSchema = z.object({
  ids: z.array(z.string()),
});
