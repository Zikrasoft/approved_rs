import { CATALOG_EVENTS } from '../../lib/catalog-version';

jest.mock('../../lib/metadata', () => ({ updateStoreMetadata: jest.fn() }));
jest.mock('../../lib/rebuild', () => {
  const schedule = jest.fn();
  return {
    ...jest.requireActual('../../lib/rebuild'),
    createRebuildScheduler: jest.fn(() => ({ schedule, pending: () => false })),
  };
});

type Stamp = {
  default: (args: object) => Promise<void>;
  config: { event: string[] };
};

const logger = { info: jest.fn(), error: jest.fn() };
const container = { resolve: () => logger };

const load = () => {
  let stamp!: Stamp;
  let create!: jest.Mock;
  let write!: jest.Mock;
  jest.isolateModules(() => {
    stamp = jest.requireActual('../catalog-stamp');
    create = jest.requireMock('../../lib/rebuild').createRebuildScheduler;
    write = jest.requireMock('../../lib/metadata').updateStoreMetadata;
  });
  create.mockClear();
  write.mockClear();
  const schedule: jest.Mock = create.getMockImplementation()!().schedule;
  schedule.mockClear();
  return {
    stamp,
    create,
    write,
    schedule,
    fire: (name: string) =>
      stamp.default({ event: { name, data: { id: 'x' } }, container }),
  };
};

const ENV = [
  'REBUILD_ON_CATALOG_EVENTS',
  'REBUILD_DEBOUNCE_MS',
  'GITHUB_DISPATCH_TOKEN',
];

afterEach(() => {
  for (const key of ENV) delete process.env[key];
});

describe('the catalog-stamp subscriber', () => {
  it('stamps a fresh catalogue version on every catalogue event', async () => {
    const { fire, write } = load();

    await fire('product.updated');

    expect(write).toHaveBeenCalledWith(container, {
      catalog_version: expect.stringMatching(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      ),
    });
  });

  it('builds the scheduler once, from the environment, and feeds it every event', async () => {
    process.env.REBUILD_ON_CATALOG_EVENTS = 'true';
    process.env.REBUILD_DEBOUNCE_MS = '5000';
    process.env.GITHUB_DISPATCH_TOKEN = 'github_pat_x';
    const { fire, create, schedule } = load();

    await fire('product.updated');
    await fire('translation.created');

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        configured: true,
        debounceMs: 5000,
        target: expect.objectContaining({ token: 'github_pat_x', ref: 'main' }),
      }),
    );
    expect(schedule.mock.calls.map(([name]) => name)).toEqual([
      'product.updated',
      'translation.created',
    ]);
  });

  it('still stamps when catalogue rebuilds are switched off', async () => {
    const { fire, create, write } = load();

    await fire('product.created');

    expect(write).toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ configured: false }),
    );
  });

  it('listens to every catalogue event', () => {
    expect(load().stamp.config.event).toEqual([...CATALOG_EVENTS]);
  });
});
