import { model } from '@medusajs/framework/utils';

export const CATALOGUE_RUN_KINDS = [
  'import',
  'publish',
  'deletion',
  'merge',
  'rename',
] as const;

export const CATALOGUE_RUN_STATUSES = [
  'running',
  'succeeded',
  'failed',
] as const;

const CatalogueRun = model
  .define('catalogue_run', {
    id: model.id().primaryKey(),
    kind: model.enum([...CATALOGUE_RUN_KINDS]),
    supplier_id: model.text().nullable(),
    status: model.enum([...CATALOGUE_RUN_STATUSES]),
    failed_step: model.text().nullable(),
    error: model.text().nullable(),
    report: model.json().nullable(),
    heartbeat_at: model.dateTime(),
    finished_at: model.dateTime().nullable(),
    created_by: model.text().nullable(),
  })
  .indexes([
    {
      name: 'IDX_catalogue_run_one_running',
      on: ['status'],
      unique: true,
      where: { status: 'running' },
    },
    { on: ['kind', 'supplier_id', 'created_at'] },
  ]);

export default CatalogueRun;
