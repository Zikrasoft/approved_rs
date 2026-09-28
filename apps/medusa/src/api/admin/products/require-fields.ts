import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { z } from 'zod';

import { queryOne } from '../../../lib/query';
import { SHOP } from '../../../lib/shop';
import { isLatin, translit } from '../../../lib/translit';

export const draftSchema = z.looseObject({
  title: z.string().nullish(),
  handle: z.string().nullish(),
  shipping_profile_id: z.string().nullish(),
  sales_channels: z
    .array(z.looseObject({ id: z.string().optional() }))
    .nullish(),
  type_id: z.string().nullish(),
  status: z.string().nullish(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
});

export type ProductDraft = z.infer<typeof draftSchema>;

const objectSchema = z.record(z.string(), z.unknown());

export function requestBodies(req: MedusaRequest): Record<string, unknown>[] {
  return [...new Set([req.validatedBody, req.body])].filter(
    (body): body is Record<string, unknown> =>
      objectSchema.safeParse(body).success,
  );
}

export function handleFor(
  draft: Pick<ProductDraft, 'title' | 'handle'>,
): string | null {
  const handle = draft.handle?.trim();
  if (handle && isLatin(handle)) {
    return null;
  }
  const spelled = translit(handle || draft.title || '');
  return spelled && spelled !== handle ? spelled : null;
}

export async function fillProductDefaults(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction,
): Promise<void> {
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const profile = await queryOne<{ id: string }>(
      query,
      'shipping_profile',
      ['id'],
      {
        type: 'default',
      },
    );
    const channel = await queryOne<{ id: string }>(
      query,
      'sales_channel',
      ['id'],
      {
        name: SHOP.salesChannelName,
      },
    );

    for (const body of requestBodies(req)) {
      const draft = draftSchema.safeParse(body);
      if (!draft.success) {
        continue;
      }
      const handle = handleFor(draft.data);
      if (handle) {
        body.handle = handle;
      }
      if (!draft.data.shipping_profile_id && profile) {
        body.shipping_profile_id = profile.id;
      }
      if (!draft.data.sales_channels?.some((row) => row.id) && channel) {
        body.sales_channels = [{ id: channel.id }];
      }
    }
    next();
  } catch (error) {
    next(error as Error);
  }
}
