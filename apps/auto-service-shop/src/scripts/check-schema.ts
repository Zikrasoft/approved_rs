import type { ExecArgs } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { schemaProblems } from '../lib/schema-check';

export default async function checkSchema({ container }: ExecArgs) {
  const problems = await schemaProblems(
    container.resolve(ContainerRegistrationKeys.PG_CONNECTION),
  );
  if (problems.length) {
    throw new Error(
      `The database schema is not what the migrations build:\n${problems.join('\n')}`,
    );
  }
}
