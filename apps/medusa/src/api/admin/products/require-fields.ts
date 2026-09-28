import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import {
  ContainerRegistrationKeys,
  MedusaError,
} from '@medusajs/framework/utils';
import { SERVICE_TYPE, parseAttributes } from '@podbor/shop-catalog';
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

const SPEC_KEY = 'spec';
const FITMENT_KEY = 'fitment';
const PUBLISHED = 'published';
const BATCH_ID = 'batch';

type Stored = {
  status?: string | null;
  metadata?: Record<string, unknown> | null;
  type?: { value?: string | null } | null;
};

type Inspected = {
  typeKey: string | undefined;
  metadata: Record<string, unknown>;
  touchesSpec: boolean;
  publishing: boolean;
};

async function inspect(req: MedusaRequest): Promise<Inspected> {
  const parsed = draftSchema.safeParse(req.validatedBody ?? req.body ?? {});
  const draft: ProductDraft = parsed.success ? parsed.data : {};
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const id = req.params?.id;
  const stored = id
    ? await queryOne<Stored>(
        query,
        'product',
        ['status', 'metadata', 'type.value'],
        { id },
      )
    : undefined;
  const chosenType = draft.type_id
    ? await queryOne<{ value: string }>(query, 'product_type', ['value'], {
        id: draft.type_id,
      })
    : undefined;

  return {
    typeKey: draft.type_id
      ? chosenType?.value
      : (stored?.type?.value ?? undefined),
    metadata: { ...(stored?.metadata ?? {}), ...(draft.metadata ?? {}) },
    touchesSpec: Boolean(
      draft.metadata &&
      (SPEC_KEY in draft.metadata || FITMENT_KEY in draft.metadata),
    ),
    publishing: (draft.status ?? stored?.status) === PUBLISHED,
  };
}

const refusal = (message: string) =>
  new MedusaError(MedusaError.Types.INVALID_DATA, message);

export async function requireValidSpec(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction,
): Promise<void> {
  if (req.params?.id === BATCH_ID) {
    next();
    return;
  }
  try {
    const product = await inspect(req);
    if (product.touchesSpec && product.typeKey !== SERVICE_TYPE) {
      const result = parseAttributes(product.typeKey, product.metadata);
      if (!result.ok) {
        next(refusal(`Характеристики товара не сходятся: ${result.error}`));
        return;
      }
    }
    next();
  } catch (error) {
    next(error as Error);
  }
}

export async function requireReadyToPublish(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction,
): Promise<void> {
  if (req.params?.id === BATCH_ID) {
    next();
    return;
  }
  try {
    const product = await inspect(req);
    if (product.publishing && product.typeKey !== SERVICE_TYPE) {
      if (!product.typeKey) {
        next(refusal('Товар не выпустить на сайт: не выбран тип товара'));
        return;
      }
      const result = parseAttributes(product.typeKey, product.metadata);
      if (!result.ok) {
        next(refusal(`Товар не выпустить на сайт: ${result.error}`));
        return;
      }
    }
    next();
  } catch (error) {
    next(error as Error);
  }
}

const batchItemSchema = z.looseObject({
  type_id: z.unknown().optional(),
  status: z.unknown().optional(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
});

const batchSchema = z.looseObject({
  create: z.array(batchItemSchema).nullish(),
  update: z.array(batchItemSchema).nullish(),
});

type BatchItem = z.infer<typeof batchItemSchema>;

const touchesGuardedFields = (item: BatchItem): boolean =>
  item.type_id !== undefined ||
  item.status === PUBLISHED ||
  Boolean(
    item.metadata &&
    (SPEC_KEY in item.metadata || FITMENT_KEY in item.metadata),
  );

export function refuseGuardedBatchEdits(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction,
): void {
  const parsed = batchSchema.safeParse(req.validatedBody ?? req.body ?? {});
  const items = parsed.success
    ? [...(parsed.data.create ?? []), ...(parsed.data.update ?? [])]
    : [];
  if (items.some(touchesGuardedFields)) {
    next(
      refusal(
        'Характеристики, совместимость и публикацию меняйте в карточке товара',
      ),
    );
    return;
  }
  next();
}
