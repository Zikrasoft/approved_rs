import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';

import { GET } from '../health/ready/route';

const call = async (graph: jest.Mock, get: jest.Mock) => {
  const error = jest.fn();
  const services: Record<string, unknown> = {
    [ContainerRegistrationKeys.QUERY]: { graph },
    [Modules.CACHE]: { get },
    [ContainerRegistrationKeys.LOGGER]: { error },
  };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await GET(
    { scope: { resolve: (key: string) => services[key] } } as never,
    res as never,
  );
  return { res, error };
};

describe('GET /health/ready', () => {
  it('answers ok when the database and the cache both answer', async () => {
    const { res } = await call(
      jest.fn().mockResolvedValue({ data: [] }),
      jest.fn().mockResolvedValue(null),
    );

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ status: 'ok' });
  });

  it('answers 503 and logs why when the database is down', async () => {
    const { res, error } = await call(
      jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      jest.fn().mockResolvedValue(null),
    );

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ status: 'unavailable' });
    expect(error).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'));
  });
});
