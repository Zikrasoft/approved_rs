import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { z } from 'zod';

import {
  type Change,
  type Level,
  type TreeEdit,
  applyEdit,
  treeComplaint,
} from '../../../lib/vehicle-tree';
import {
  type Scope,
  loadVehicleTree,
  productsOrphanedBy,
} from '../../../lib/vehicles';
import { VEHICLE_MODULE } from '../../../modules/vehicle/id';

export type Mode = 'create' | 'update' | 'delete';

const name = z.string().trim().min(1).max(60);
const year = z.number().int().min(1950).max(2100);
const levelSchema = z.enum(['makes', 'models', 'generations']);

type Body = Change & { make_id?: string; vehicle_model_id?: string };

const CREATE: Record<Level, z.ZodType<Body>> = {
  makes: z.object({ name }).strict(),
  models: z.object({ make_id: z.string().min(1), name }).strict(),
  generations: z
    .object({
      vehicle_model_id: z.string().min(1),
      name,
      yearFrom: year,
      yearTo: year,
    })
    .strict(),
};

const UPDATE: Record<Level, z.ZodType<Body>> = {
  makes: z.object({ name }).strict(),
  models: z.object({ name }).strict(),
  generations: z
    .object({ name, yearFrom: year, yearTo: year })
    .partial()
    .strict()
    .refine((body) => Object.keys(body).length > 0, 'нечего менять'),
};

const refusal = (reason: string) =>
  new MedusaError(
    MedusaError.Types.INVALID_DATA,
    `Справочник не сохранён: ${reason}`,
  );

export function readEdit(
  params: Record<string, string | undefined>,
  body: unknown,
  mode: Mode,
): TreeEdit {
  const level = levelSchema.safeParse(params.level);
  if (!level.success) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      'Такого раздела в справочнике нет',
    );
  }
  const id = params.id ?? '';
  if (mode === 'delete') {
    return { kind: 'delete', level: level.data, id };
  }
  const parsed = (mode === 'create' ? CREATE : UPDATE)[level.data].safeParse(
    body,
  );
  if (!parsed.success) {
    throw refusal(z.prettifyError(parsed.error));
  }
  const { make_id, vehicle_model_id, ...change } = parsed.data;
  return mode === 'create'
    ? {
        kind: 'create',
        level: level.data,
        parentId: make_id ?? vehicle_model_id,
        change,
      }
    : { kind: 'update', level: level.data, id, change };
}

type Columns = {
  name?: string;
  year_from?: number;
  year_to?: number;
  make_id?: string;
  vehicle_model_id?: string;
};

type Suffix = 'Makes' | 'Models' | 'Generations';

type VehicleWrites = Record<
  `${'create' | 'update'}Vehicle${Suffix}`,
  (data: Columns & { id?: string }) => Promise<unknown>
> &
  Record<`deleteVehicle${Suffix}`, (id: string) => Promise<unknown>>;

const SUFFIX: Record<Level, Suffix> = {
  makes: 'Makes',
  models: 'Models',
  generations: 'Generations',
};

const columns = (change: Change): Columns => ({
  ...(change.name === undefined ? {} : { name: change.name }),
  ...(change.yearFrom === undefined ? {} : { year_from: change.yearFrom }),
  ...(change.yearTo === undefined ? {} : { year_to: change.yearTo }),
});

const parentColumn = (edit: Extract<TreeEdit, { kind: 'create' }>): Columns =>
  edit.level === 'models'
    ? { make_id: edit.parentId }
    : edit.level === 'generations'
      ? { vehicle_model_id: edit.parentId }
      : {};

async function persist(store: VehicleWrites, edit: TreeEdit): Promise<void> {
  const suffix = SUFFIX[edit.level];
  if (edit.kind === 'delete') {
    await store[`deleteVehicle${suffix}` as const](edit.id);
  } else if (edit.kind === 'update') {
    await store[`updateVehicle${suffix}` as const]({
      id: edit.id,
      ...columns(edit.change),
    });
  } else {
    await store[`createVehicle${suffix}` as const]({
      ...columns(edit.change),
      ...parentColumn(edit),
    });
  }
}

const SHOWN = 5;

const strandedMessage = (titles: string[]): string =>
  `Справочник не изменён: на эту запись опирается совместимость товаров (${titles.length}): ${titles
    .slice(0, SHOWN)
    .join(
      ', ',
    )}${titles.length > SHOWN ? ' и другие' : ''}. Сначала поправьте совместимость в их карточках.`;

export async function saveEdit(
  scope: Scope,
  edit: TreeEdit,
): Promise<string | undefined> {
  const tree = await loadVehicleTree(scope);
  const next = applyEdit(tree, edit);
  if (!next) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      'Такой записи в справочнике нет',
    );
  }
  const complaint = treeComplaint(next);
  if (complaint) {
    throw refusal(complaint);
  }
  const stranded =
    edit.kind === 'create' ? [] : await productsOrphanedBy(scope, tree, next);
  if (stranded.length) {
    return strandedMessage(stranded);
  }
  await persist(scope.resolve<VehicleWrites>(VEHICLE_MODULE), edit);
  return undefined;
}

export async function answer(
  req: MedusaRequest,
  res: MedusaResponse,
  mode: Mode,
): Promise<void> {
  const conflict = await saveEdit(
    req.scope,
    readEdit(req.params, req.body, mode),
  );
  if (conflict) {
    res.status(409).json({ message: conflict });
    return;
  }
  res
    .status(mode === 'create' ? 201 : 200)
    .json({ makes: await loadVehicleTree(req.scope) });
}
