import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import {
  ContainerRegistrationKeys,
  MedusaError,
} from '@medusajs/framework/utils';
import { parseAttributes } from '@podbor/shop-catalog';
import { z } from 'zod';

import { updateProductMetadata } from '../../../../../lib/metadata';
import { selectOne } from '../../../../../lib/query';

const bodySchema = z
  .object({
    spec: z.record(z.string(), z.unknown()),
    fitment: z.array(z.unknown()),
  })
  .strict();

export const specProductSchema = z.object({
  id: z.string(),
  type: z.object({ value: z.string().nullish() }).nullish(),
});

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
  const product = await selectOne(query, 'product', specProductSchema, {
    id: req.params.id,
  });
  if (!product) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Такого товара нет');
  }

  const result = parseAttributes(product.type?.value, body.data);
  if (!result.ok) {
    throw refusal(result.error);
  }
  const metadata = await updateProductMetadata(req.scope, product.id, {
    spec: result.spec,
    fitment: result.fitment,
  });
  res.json({ metadata });
}
