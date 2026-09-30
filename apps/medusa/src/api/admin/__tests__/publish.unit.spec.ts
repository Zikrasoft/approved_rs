import { requestBuild } from '../../../lib/rebuild';
import { MAX_PUBLISHES_PER_IP, limitPublishes } from '../publish-limit';
import { POST } from '../publish/route';

jest.mock('../../../lib/rebuild', () => ({
  ...jest.requireActual('../../../lib/rebuild'),
  requestBuild: jest.fn(),
}));

const publish = async () => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const logger = { info: jest.fn(), error: jest.fn() };
  await POST({ scope: { resolve: () => logger } } as never, res as never);
  return { res, logger };
};

afterEach(() => {
  delete process.env.GITHUB_DISPATCH_TOKEN;
});

describe('POST /admin/publish', () => {
  it.each([
    ['started', 202],
    ['not-configured', 503],
    ['unauthorised', 502],
    ['refused', 502],
  ])(
    'answers %s with %i and a Russian explanation',
    async (outcome, status) => {
      (requestBuild as jest.Mock).mockResolvedValue(outcome);

      const { res, logger } = await publish();

      expect(res.status).toHaveBeenCalledWith(status);
      expect(res.json).toHaveBeenCalledWith({
        outcome,
        message: expect.stringMatching(/[а-яё]/i),
      });
      expect(logger.info).toHaveBeenCalledWith(
        `Publish requested by the admin: ${outcome}`,
      );
    },
  );

  it('dispatches with the token from the environment', async () => {
    process.env.GITHUB_DISPATCH_TOKEN = 'github_pat_env';
    (requestBuild as jest.Mock).mockResolvedValue('started');

    await publish();

    const calls = (requestBuild as jest.Mock).mock.calls;
    expect(calls[calls.length - 1][0].target).toMatchObject({
      token: 'github_pat_env',
      ref: 'main',
    });
  });
});

describe('limitPublishes', () => {
  it('refuses the seventh publish in a minute from one address', () => {
    const ip = `ip_${Math.random()}`;
    const press = () => {
      const res = { status: jest.fn().mockReturnValue({ json: jest.fn() }) };
      const next = jest.fn();
      limitPublishes({ ip } as never, res as never, next as never);
      return { res, next };
    };

    for (let i = 0; i < MAX_PUBLISHES_PER_IP; i += 1) {
      expect(press().next).toHaveBeenCalled();
    }
    expect(press().res.status).toHaveBeenCalledWith(429);
  });
});
