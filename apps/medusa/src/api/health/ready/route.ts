import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const cache = req.scope.resolve(Modules.CACHE);

  try {
    await Promise.all([
      query.graph({
        entity: 'region',
        fields: ['id'],
        pagination: { take: 1 },
      }),
      cache.get('health:ready'),
    ]);
    res.json({ status: 'ok' });
  } catch (error) {
    req.scope
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(`Readiness check failed: ${String(error)}`);
    res.status(503).json({ status: 'unavailable' });
  }
}
