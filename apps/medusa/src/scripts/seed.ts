import { ExecArgs } from '@medusajs/framework/types';

// TODO: seed whatever a future ticket's domain needs, idempotently by
// identity (name/handle/code), never overwriting an admin edit.
export default async function seed({ container }: ExecArgs) {
  const logger = container.resolve('logger');
  logger.info('No seed data defined yet.');
}
