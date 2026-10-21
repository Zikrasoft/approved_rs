import { model } from '@medusajs/framework/utils';

export const PUBLISH_RUN_STATUSES = ['running', 'succeeded', 'failed'] as const;

const PublishRun = model
  .define('publish_run', {
    id: model.id().primaryKey(),
    status: model.enum([...PUBLISH_RUN_STATUSES]),
    failed_step: model.text().nullable(),
    error: model.text().nullable(),
    finished_at: model.dateTime().nullable(),
    created_by: model.text().nullable(),
  })
  .indexes([
    {
      name: 'IDX_publish_run_one_running',
      on: ['status'],
      unique: true,
      where: { status: 'running' },
    },
  ]);

export default PublishRun;
