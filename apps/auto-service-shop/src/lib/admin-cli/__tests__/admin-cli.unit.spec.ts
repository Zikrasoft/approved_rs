import { runAdminCli, USAGE } from '..';

const env = {
  CARLAB_ADMIN_URL: 'https://admin.example.test',
  CARLAB_ADMIN_API_KEY: 'sk_test',
};

const run = (status: string, extra: Record<string, unknown> = {}) => ({
  id: 'run_1',
  status,
  failed_step: null,
  error: null,
  report: null,
  ...extra,
});

const answer = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

const harness = (bodies: unknown[]) => {
  const calls: { url: string; method: string; authorization: string }[] = [];
  const lines: string[] = [];
  const fetch = jest.fn((url: URL, init: RequestInit) => {
    calls.push({
      url: url.toString(),
      method: init.method ?? 'GET',
      authorization: new Headers(init.headers).get('authorization') ?? '',
    });
    return answer(bodies[calls.length - 1]);
  }) as unknown as typeof globalThis.fetch;
  const deps = {
    env,
    fetch,
    log: (line: string) => lines.push(line),
    sleep: jest.fn(() => Promise.resolve()),
  };
  return { calls, lines, deps };
};

describe('runAdminCli', () => {
  it('starts a Publish with the secret key and waits until it leaves running', async () => {
    const { calls, lines, deps } = harness([
      { publish_run: run('running') },
      { publish_run: run('running') },
      { publish_run: run('succeeded') },
    ]);

    const code = await runAdminCli(['publish', '--wait'], deps);

    expect(code).toBe(0);
    expect(calls.map(({ method, url }) => `${method} ${url}`)).toEqual([
      'POST https://admin.example.test/admin/publish-runs',
      'GET https://admin.example.test/admin/publish-runs/latest',
      'GET https://admin.example.test/admin/publish-runs/latest',
    ]);
    expect(calls[0].authorization).toBe(
      `Basic ${Buffer.from('sk_test:').toString('base64')}`,
    );
    expect(deps.sleep).toHaveBeenCalledTimes(2);
    expect(JSON.parse(lines[0])).toMatchObject({ status: 'succeeded' });
  });

  it('starts an Import without waiting', async () => {
    const { calls, lines, deps } = harness([{ import_run: run('running') }]);

    expect(await runAdminCli(['import', 'sup_1'], deps)).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      'https://admin.example.test/admin/suppliers/sup_1/import',
    );
    expect(JSON.parse(lines[0])).toMatchObject({ status: 'running' });
  });

  it("reads a supplier's latest Import and exits 1 when it failed", async () => {
    const { calls, lines, deps } = harness([
      { import_runs: [run('failed', { failed_step: 'read', error: 'boom' })] },
    ]);

    expect(await runAdminCli(['status', 'sup_1'], deps)).toBe(1);
    expect(calls[0].url).toBe(
      'https://admin.example.test/admin/suppliers/sup_1/import-runs',
    );
    expect(JSON.parse(lines[0])).toMatchObject({ error: 'boom' });
  });

  it('prints null when nothing was ever published', async () => {
    const { lines, deps } = harness([{ publish_run: null }]);

    expect(await runAdminCli(['status', '--wait'], deps)).toBe(0);
    expect(lines).toEqual(['null']);
  });

  it('prints null for a supplier that never imported', async () => {
    const { lines, deps } = harness([{ import_runs: [] }]);

    expect(await runAdminCli(['status', 'sup_1'], deps)).toBe(0);
    expect(lines).toEqual(['null']);
  });

  it('prints the usage for an unknown command or an import without a supplier', async () => {
    for (const argv of [[], ['import'], ['nope']]) {
      const { calls, lines, deps } = harness([]);
      expect(await runAdminCli(argv, deps)).toBe(2);
      expect(lines).toEqual([USAGE]);
      expect(calls).toHaveLength(0);
    }
  });

  it('fails loudly on a refused call', async () => {
    const { deps } = harness([]);
    deps.fetch = jest.fn(() =>
      answer({}, 401),
    ) as unknown as typeof globalThis.fetch;

    await expect(runAdminCli(['publish'], deps)).rejects.toThrow(
      'POST /admin/publish-runs answered 401',
    );
  });

  it('refuses a key that is not a secret API key', async () => {
    const { deps } = harness([]);

    await expect(
      runAdminCli(['publish'], {
        ...deps,
        env: { ...env, CARLAB_ADMIN_API_KEY: 'pk_test' },
      }),
    ).rejects.toThrow();
  });
});
