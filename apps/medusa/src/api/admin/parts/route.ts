import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';

import { PART_MODULE } from '../../../modules/part';
import { PART_IDENTIFIER_TYPES } from '../../../modules/part/models/part-identifier';
import type PartModuleService from '../../../modules/part/service';

const searchQuerySchema = z.object({
  q: z.string().min(1),
});

const identifierSchema = z.object({
  id: z.string(),
  type: z.enum(PART_IDENTIFIER_TYPES),
  brand: z.string(),
  value: z.string(),
});

const partSchema = z.object({
  id: z.string(),
  name: z.string(),
  identifiers: z.array(identifierSchema),
});

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { q } = searchQuerySchema.parse(req.query);

  const partModuleService: PartModuleService = req.scope.resolve(PART_MODULE);

  const matches = await partModuleService.listPartIdentifiers({
    $or: [{ value: { $ilike: `%${q}%` } }, { brand: { $ilike: `%${q}%` } }],
  });

  const partIds = [...new Set(matches.map((identifier) => identifier.part_id))];
  const parts = partIds.length
    ? await partModuleService.listParts({ id: partIds })
    : [];
  const identifiers = partIds.length
    ? await partModuleService.listPartIdentifiers({ part_id: partIds })
    : [];

  const identifiersByPartId = new Map<string, typeof identifiers>();
  for (const identifier of identifiers) {
    const group = identifiersByPartId.get(identifier.part_id) ?? [];
    group.push(identifier);
    identifiersByPartId.set(identifier.part_id, group);
  }

  const response = parts.map((part) => ({
    id: part.id,
    name: part.name,
    identifiers: identifiersByPartId.get(part.id) ?? [],
  }));

  res.json({ parts: z.array(partSchema).parse(response) });
}

const createBodySchema = z.object({
  name: z.string().min(1),
  identifier: z.object({
    type: z.enum(PART_IDENTIFIER_TYPES),
    brand: z.string().min(1),
    value: z.string().min(1),
  }),
});

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { name, identifier } = createBodySchema.parse(req.body);

  const partModuleService: PartModuleService = req.scope.resolve(PART_MODULE);

  const part = await partModuleService.createParts({ name });
  const createdIdentifier = await partModuleService.createPartIdentifiers({
    part_id: part.id,
    ...identifier,
  });

  res.json({
    part: partSchema.parse({
      id: part.id,
      name: part.name,
      identifiers: [createdIdentifier],
    }),
  });
}
