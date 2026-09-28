type RateLimit = typeof import('../rate-limit');

const load = (): RateLimit => {
  let module!: RateLimit;
  jest.isolateModules(() => {
    module = jest.requireActual('../rate-limit');
  });
  return module;
};

const hit = (middleware: ReturnType<RateLimit['limit']>, ip: string) => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  middleware({ ip } as never, res as never, next as never);
  return {
    refused: res.status.mock.calls[0]?.[0] === 429,
    message: res.json.mock.calls[0]?.[0]?.message,
    next,
  };
};

afterEach(() => jest.useRealTimers());

describe('limit', () => {
  it('lets the window fill, then answers 429 with the given message', () => {
    const { limit } = load();
    const middleware = limit((req) => [[`t:${req.ip}`, 2]], 'Подождите минуту');

    expect(hit(middleware, 'a').refused).toBe(false);
    expect(hit(middleware, 'a').refused).toBe(false);
    expect(hit(middleware, 'a')).toMatchObject({
      refused: true,
      message: 'Подождите минуту',
    });
  });

  it('forgets an attempt once the window has passed', () => {
    jest.useFakeTimers({ now: 0 });
    const { limit, WINDOW_MS } = load();
    const middleware = limit((req) => [[`t:${req.ip}`, 1]], 'x');

    hit(middleware, 'a');
    expect(hit(middleware, 'a').refused).toBe(true);

    jest.setSystemTime(WINDOW_MS);
    expect(hit(middleware, 'a').refused).toBe(false);
  });

  it('refuses when any one bucket is full, and counts none of them then', () => {
    const { limit } = load();
    const middleware = limit(
      (req) => [
        [`ip:${req.ip}`, 1],
        ['shared', 3],
      ],
      'x',
    );

    hit(middleware, 'a');
    expect(hit(middleware, 'a').refused).toBe(true);
    expect(hit(middleware, 'b').refused).toBe(false);
    expect(hit(middleware, 'c').refused).toBe(false);
    expect(hit(middleware, 'd').refused).toBe(true);
  });

  it('sweeps idle keys once the map grows past the sweep mark', () => {
    jest.useFakeTimers({ now: 1_000_000 });
    const { limit, trackedKeys, SWEEP_ABOVE, WINDOW_MS, SWEEP_EVERY_MS } =
      load();
    const middleware = limit((req) => [[`t:${req.ip}`, 1]], 'x');

    for (let i = 0; i <= SWEEP_ABOVE; i += 1) hit(middleware, `idle-${i}`);
    expect(trackedKeys()).toBe(SWEEP_ABOVE + 1);

    jest.setSystemTime(1_000_000 + WINDOW_MS + SWEEP_EVERY_MS);
    hit(middleware, 'fresh');

    expect(trackedKeys()).toBe(1);
  });

  it('forgets the oldest key rather than refusing everyone when the map is full', () => {
    jest.useFakeTimers({ now: 0 });
    const { limit, trackedKeys, MAX_KEYS } = load();
    const middleware = limit((req) => [[`t:${req.ip}`, 1]], 'x');

    for (let i = 0; i <= MAX_KEYS; i += 1) hit(middleware, `flood-${i}`);

    expect(trackedKeys()).toBe(MAX_KEYS);
    expect(hit(middleware, 'flood-0').refused).toBe(false);
    expect(hit(middleware, `flood-${MAX_KEYS}`).refused).toBe(true);
  });

  it('keys an unknown address together rather than letting it through free', () => {
    const { clientKey } = load();

    expect(clientKey({} as never, 'complete')).toBe('complete:ip:?');
    expect(clientKey({ ip: '198.51.100.7' } as never, 'complete')).toBe(
      'complete:ip:198.51.100.7',
    );
  });
});
