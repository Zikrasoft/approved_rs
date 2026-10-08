import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import {
  ContainerRegistrationKeys,
  MedusaError,
} from '@medusajs/framework/utils';
import {
  PRODUCT_TYPES,
  SERVICE_TYPE,
  parseAttributes,
  productType,
} from '@podbor/shop-catalog';
import { z } from 'zod';

import { type Query, selectOne } from '../../../lib/query';
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

export const idRowSchema = z.object({ id: z.string() });

export const typeValueSchema = z.object({ value: z.string() });

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

async function freeHandle(query: Query, handle: string): Promise<string> {
  let candidate = handle;
  for (
    let suffix = 2;
    await selectOne(query, 'product', idRowSchema, { handle: candidate });
    suffix += 1
  ) {
    candidate = `${handle}-${suffix}`;
  }
  return candidate;
}

export async function fillProductDefaults(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction,
): Promise<void> {
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const profile = await selectOne(query, 'shipping_profile', idRowSchema, {
      type: 'default',
    });
    const channel = await selectOne(query, 'sales_channel', idRowSchema, {
      name: SHOP.salesChannelName,
    });

    for (const body of requestBodies(req)) {
      const draft = draftSchema.safeParse(body);
      if (!draft.success) {
        continue;
      }
      const handle = handleFor(draft.data);
      if (handle) {
        body.handle = draft.data.handle?.trim()
          ? handle
          : await freeHandle(query, handle);
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

const priceSchema = z.looseObject({
  currency_code: z.string().nullish(),
  amount: z.union([z.number(), z.string()]).nullish(),
});

const variantSchema = z.looseObject({
  id: z.string().nullish(),
  title: z.string().nullish(),
  prices: z.array(priceSchema).nullish(),
});

type Variant = z.infer<typeof variantSchema>;

const variantsSchema = z.array(variantSchema);

const sentVariantsSchema = z.looseObject({ variants: variantsSchema });

export const storedProductSchema = z.object({
  status: z.string().nullish(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
  type: z.object({ value: z.string().nullish() }).nullish(),
  variants: variantsSchema.nullish(),
});

type Inspected = {
  typeKey: string | undefined;
  metadata: Record<string, unknown>;
  touchesSpec: boolean;
  changesType: boolean;
  publishing: boolean;
  variants: Variant[];
};

async function inspect(req: MedusaRequest): Promise<Inspected> {
  const body = req.validatedBody ?? req.body ?? {};
  const parsed = draftSchema.safeParse(body);
  const draft: ProductDraft = parsed.success ? parsed.data : {};
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const id = req.params?.id;
  const stored = id
    ? await selectOne(query, 'product', storedProductSchema, { id })
    : undefined;
  const changesType = 'type_id' in draft;
  const chosenType =
    typeof draft.type_id === 'string'
      ? await selectOne(query, 'product_type', typeValueSchema, {
          id: draft.type_id,
        })
      : undefined;
  const sent = sentVariantsSchema.safeParse(body);
  const storedVariants = stored?.variants ?? [];

  return {
    typeKey: changesType
      ? chosenType?.value
      : (stored?.type?.value ?? undefined),
    metadata: { ...(stored?.metadata ?? {}), ...(draft.metadata ?? {}) },
    touchesSpec: Boolean(
      draft.metadata &&
      (SPEC_KEY in draft.metadata || FITMENT_KEY in draft.metadata),
    ),
    changesType,
    publishing: (draft.status ?? stored?.status) === PUBLISHED,
    variants: sent.success
      ? sent.data.variants.map(
          (variant) =>
            (!variant.prices &&
              storedVariants.find((row) => row.id && row.id === variant.id)) ||
            variant,
        )
      : storedVariants,
  };
}

const pricedInDinars = (variant: Variant): boolean =>
  (variant.prices ?? []).some(
    (price) =>
      price.currency_code?.toLowerCase() === SHOP.currency &&
      Number(price.amount) > 0,
  );

function priceComplaint(variants: Variant[]): string | undefined {
  if (!variants.length) {
    return 'нет ни одного варианта с ценой';
  }
  const index = variants.findIndex((variant) => !pricedInDinars(variant));
  if (index < 0) {
    return undefined;
  }
  const name = variants[index].title?.trim() || `${index + 1}`;
  return `у варианта «${name}» нет цены в динарах`;
}

const refusal = (message: string) =>
  new MedusaError(MedusaError.Types.INVALID_DATA, message);

function typeComplaint(typeKey: string | undefined): string | undefined {
  if (!typeKey) {
    return 'не выбран тип товара';
  }
  if (typeKey !== SERVICE_TYPE && !productType(typeKey)) {
    return `тип «${typeKey}» не из каталога сайта`;
  }
  return undefined;
}

function specComplaint(product: Inspected): string | undefined {
  const result = parseAttributes(product.typeKey, product.metadata);
  return result.ok ? undefined : result.error;
}

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
    const recheck =
      product.touchesSpec ||
      (product.changesType && SPEC_KEY in product.metadata);
    if (recheck && product.typeKey !== SERVICE_TYPE) {
      const complaint =
        typeComplaint(product.typeKey) ?? specComplaint(product);
      if (complaint) {
        next(refusal(`Характеристики товара не сходятся: ${complaint}`));
        return;
      }
    }
    next();
  } catch (error) {
    next(error as Error);
  }
}

function publishComplaint(product: Inspected): string | undefined {
  const problem = typeComplaint(product.typeKey);
  if (problem) {
    return problem;
  }
  if (product.typeKey !== SERVICE_TYPE) {
    const result = parseAttributes(product.typeKey, product.metadata);
    if (!result.ok) {
      return result.error;
    }
  }
  return priceComplaint(product.variants);
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
    const complaint = product.publishing
      ? publishComplaint(product)
      : undefined;
    if (complaint) {
      next(refusal(`Товар не выпустить на сайт: ${complaint}`));
      return;
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

export function refuseProductImports(
  _req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction,
): void {
  next(
    refusal('Импорт товаров отключён — создавайте и меняйте товары в карточке'),
  );
}

const REGISTRY_TYPE_KEYS: readonly string[] = [
  ...PRODUCT_TYPES.map((type) => type.key),
  SERVICE_TYPE,
];

export async function refuseRegistryTypeEdits(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction,
): Promise<void> {
  try {
    const id = req.params?.id;
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const stored = id
      ? await selectOne(query, 'product_type', typeValueSchema, { id })
      : undefined;
    if (stored && REGISTRY_TYPE_KEYS.includes(stored.value)) {
      next(
        refusal(
          `Тип «${stored.value}» задан каталогом сайта — его нельзя переименовать или удалить`,
        ),
      );
      return;
    }
    next();
  } catch (error) {
    next(error as Error);
  }
}
