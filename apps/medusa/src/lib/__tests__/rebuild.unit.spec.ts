import {
  DISPATCH_REF,
  DISPATCH_URL,
  createRebuildScheduler,
  dispatchTarget,
  requestBuild,
} from '../rebuild';

const logger = { info: jest.fn(), error: jest.fn() };

const TARGET = {
  url: DISPATCH_URL,
  token: 'github_pat_example',
  ref: DISPATCH_REF,
};

const scheduler = (over: Record<string, unknown> = {}) => {
  const send = jest.fn().mockResolvedValue({ ok: true, status: 204 });
  return {
    send,
    subject: createRebuildScheduler({
      target: TARGET,
      configured: true,
      debounceMs: 50,
      logger,
      send,
      ...over,
    }),
  };
};

const settle = (ms = 90) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(() => jest.clearAllMocks());

describe('dispatchTarget', () => {
  it('dispatches ci.yml on main of this repository when a token is set', () => {
    expect(dispatchTarget({ GITHUB_DISPATCH_TOKEN: 'github_pat_x' })).toEqual({
      url: 'https://api.github.com/repos/Zikrasoft/approved_rs/actions/workflows/ci.yml/dispatches',
      token: 'github_pat_x',
      ref: 'main',
    });
  });

  it('has nowhere to dispatch without a token', () => {
    expect(
      dispatchTarget({ GITHUB_DISPATCH_TOKEN: undefined }),
    ).toBeUndefined();
  });
});

describe('requestBuild', () => {
  it('speaks what the GitHub API expects, down to the user agent it insists on', async () => {
    const send = jest.fn().mockResolvedValue({ ok: true, status: 204 });

    expect(await requestBuild({ target: TARGET, logger, send })).toBe(
      'started',
    );

    const [url, init] = send.mock.calls[0];
    expect(url).toBe(DISPATCH_URL);
    expect(init.method).toBe('POST');
    expect(init.headers.authorization).toBe('Bearer github_pat_example');
    expect(init.headers.accept).toBe('application/vnd.github+json');
    expect(init.headers['x-github-api-version']).toBe('2022-11-28');
    expect(init.headers['user-agent']).toBe('carlab.rs medusa');
    expect(JSON.parse(init.body)).toEqual({ ref: 'main' });
  });

  it('says it is not configured instead of posting nowhere', async () => {
    expect(await requestBuild({ target: undefined, logger })).toBe(
      'not-configured',
    );
  });

  it.each([
    [401, 'unauthorised'],
    [403, 'unauthorised'],
    [422, 'refused'],
    [503, 'refused'],
  ])('reads HTTP %i as %s', async (status, outcome) => {
    const send = jest.fn().mockResolvedValue({ ok: false, status });

    expect(await requestBuild({ target: TARGET, logger, send })).toBe(outcome);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(String(status)),
    );
  });

  it('survives an unreachable API', async () => {
    const send = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    expect(await requestBuild({ target: TARGET, logger, send })).toBe(
      'refused',
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('unreachable'),
    );
  });

  it('posts through fetch when no transport is given', async () => {
    const original = global.fetch;
    const calls: string[] = [];
    global.fetch = (async (url: string) => {
      calls.push(url);
      return { ok: true, status: 204 };
    }) as unknown as typeof fetch;

    try {
      expect(await requestBuild({ target: TARGET, logger })).toBe('started');
      expect(calls).toEqual([DISPATCH_URL]);
    } finally {
      global.fetch = original;
    }
  });
});

describe('the debounce window', () => {
  it('collapses a burst of edits into one build', async () => {
    const { send, subject } = scheduler();

    for (let i = 0; i < 10; i += 1) subject.schedule('product.updated');
    expect(subject.pending()).toBe(true);
    await settle();

    expect(send).toHaveBeenCalledTimes(1);
    expect(subject.pending()).toBe(false);
  });

  it('restarts on every new edit rather than firing mid-burst', async () => {
    const { send, subject } = scheduler();

    subject.schedule('product.updated');
    await settle(30);
    subject.schedule('translation.created');
    await settle(30);

    expect(send).not.toHaveBeenCalled();
    await settle();
    expect(send).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      'Rebuild requested for 2 event(s)',
    );
  });

  it('stays quiet when catalogue rebuilds are switched off', async () => {
    const { send, subject } = scheduler({ configured: false });

    subject.schedule('product.updated');
    await settle();

    expect(send).not.toHaveBeenCalled();
    expect(subject.pending()).toBe(false);
  });

  it('refuses to fire without a token, and says why once', async () => {
    const { send, subject } = scheduler({ target: undefined });

    subject.schedule('product.updated');
    subject.schedule('product.created');
    await settle();

    expect(send).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('GITHUB_DISPATCH_TOKEN'),
    );
  });

  it('logs nothing as started when GitHub refused', async () => {
    const { subject } = scheduler({
      send: jest.fn().mockResolvedValue({ ok: false, status: 503 }),
    });

    subject.schedule('product.updated');
    await settle();

    expect(logger.info).not.toHaveBeenCalled();
  });
});
