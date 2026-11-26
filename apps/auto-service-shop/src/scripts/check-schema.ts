import type { ExecArgs } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { schemaExtras, schemaProblems } from '../lib/schema-check';

export default async function checkSchema({ container }: ExecArgs) {
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const extras = await schemaExtras(pg);
  if (extras.length) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .warn(
        `The database has more than the migrations build, kept for a newer image:\n${extras.join('\n')}`,
      );
  }
  const problems = await schemaProblems(pg);
  if (problems.length) {
    throw new Error(
      `The database schema is not what the migrations build:\n${problems.join('\n')}`,
    );
  }
}
