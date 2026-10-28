import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { z } from 'zod';

import { parseEnv } from '../../../lib/env';

const PROBE_TIMEOUT_MS = 3000;

const typesenseHealthSchema = z.object({ ok: z.literal(true) });

const pingTypesense = async () => {
  const { TYPESENSE_PROTOCOL, TYPESENSE_HOST, TYPESENSE_PORT } = parseEnv(
    process.env,
  );
  const response = await fetch(
    `${TYPESENSE_PROTOCOL}://${TYPESENSE_HOST}:${TYPESENSE_PORT}/health`,
    { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) },
  );
  typesenseHealthSchema.parse(await response.json());
};

const pingPostgres = async (req: MedusaRequest) => {
  await req.scope
    .resolve(ContainerRegistrationKeys.PG_CONNECTION)
    .raw('select 1');
};

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const probes = { postgres: pingPostgres(req), typesense: pingTypesense() };
  const results = await Promise.allSettled(Object.values(probes));
  const failed = Object.keys(probes).filter(
    (_, at) => results[at].status === 'rejected',
  );
  if (!failed.length) {
    res.json({ status: 'ok' });
    return;
  }
  req.scope
    .resolve(ContainerRegistrationKeys.LOGGER)
    .error(`Health check failed: ${failed.join(', ')}`);
  res.status(503).json({ status: 'unavailable' });
}
