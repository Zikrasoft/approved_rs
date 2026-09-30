import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import {
  ContainerRegistrationKeys,
  MedusaError,
} from '@medusajs/framework/utils';
import { parseAttributes } from '@podbor/shop-catalog';
import { z } from 'zod';

import { updateProductMetadata } from '../../../../../lib/metadata';
import { queryOne } from '../../../../../lib/query';
import { fitmentComplaintFor } from '../../../../../lib/vehicles';

const bodySchema = z
  .object({
    spec: z.record(z.string(), z.unknown()),
    fitment: z.array(z.unknown()),
  })
  .strict();

const refusal = (reason: string) =>
  new MedusaError(
    MedusaError.Types.INVALID_DATA,
    `Характеристики не сохранены: ${reason}`,
  );

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const body = bodySchema.safeParse(req.body);
  if (!body.success) {
    throw refusal(z.prettifyError(body.error));
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const product = await queryOne<{
    id: string;
    type?: { value?: string | null } | null;
  }>(query, 'product', ['id', 'type.value'], { id: req.params.id });
  if (!product) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Такого товара нет');
  }

  const result = parseAttributes(product.type?.value, body.data);
  if (!result.ok) {
    throw refusal(result.error);
  }
  const unknownCar = await fitmentComplaintFor(req.scope, result.fitment);
  if (unknownCar) {
    throw refusal(unknownCar);
  }

  const metadata = await updateProductMetadata(req.scope, product.id, {
    spec: result.spec,
    fitment: result.fitment,
  });
  res.json({ metadata });
}
