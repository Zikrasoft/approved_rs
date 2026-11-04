import { deploySite } from '../deploy';

const DISPATCH_URL =
  'https://api.github.com/repos/Zikrasoft/approved_rs/actions/workflows/publish.yml/dispatches';
const RUN_URL =
  'https://api.github.com/repos/Zikrasoft/approved_rs/actions/runs/42';
const HTML_URL = 'https://github.com/Zikrasoft/approved_rs/actions/runs/42';

type Run = { status: string; conclusion: string | null };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const github = (runs: (Run | Response | Error)[], runUrl = RUN_URL) => {
  const calls: { url: string; method: string; body: unknown }[] = [];
  globalThis.fetch = jest.fn(async (input, init) => {
    const url = String(input);
    calls.push({
      url,
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    if (url === DISPATCH_URL) {
      return json({
        workflow_run_id: 42,
        run_url: runUrl,
        html_url: HTML_URL,
      });
    }
    const next = runs.length > 1 ? runs.shift() : runs[0];
    if (next instanceof Error) throw next;
    if (next instanceof Response) return next;
    return json({ id: 42, ...next, html_url: HTML_URL });
  }) as typeof fetch;
  return calls;
};

const fast = { pollMs: 0, timeoutMs: 1000 };

describe('deploySite', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('dispatches publish.yml and waits for its run to succeed', async () => {
    const calls = github([
      { status: 'queued', conclusion: null },
      { status: 'in_progress', conclusion: null },
      { status: 'completed', conclusion: 'success' },
    ]);

    await deploySite('token', fast);

    expect(calls[0]).toEqual({
      url: DISPATCH_URL,
      method: 'POST',
      body: { ref: 'main', return_run_details: true },
    });
    expect(calls.slice(1).map(({ url }) => url)).toEqual([
      RUN_URL,
      RUN_URL,
      RUN_URL,
    ]);
  });

  it('never sends the token to a run address off the GitHub API', async () => {
    const calls = github(
      [{ status: 'completed', conclusion: 'success' }],
      'https://api.github.com.evil.example/runs/42',
    );

    await expect(deploySite('token', fast)).rejects.toThrow(
      'run_url is not on https://api.github.com',
    );
    expect(calls.map(({ url }) => url)).toEqual([DISPATCH_URL]);
  });

  it('fails when the run finishes without success', async () => {
    github([{ status: 'completed', conclusion: 'cancelled' }]);

    await expect(deploySite('token', fast)).rejects.toThrow(
      `The deploy run did not succeed: cancelled ${HTML_URL}`,
    );
  });

  it('fails when the run does not finish in time', async () => {
    github([{ status: 'in_progress', conclusion: null }]);

    await expect(
      deploySite('token', { pollMs: 5, timeoutMs: 30 }),
    ).rejects.toThrow(`The deploy run timed out: ${HTML_URL}`);
  });

  it('keeps waiting through a GitHub outage while polling', async () => {
    github([
      new Error('socket hang up'),
      json({ message: 'Server Error' }, 502),
      { status: 'completed', conclusion: 'success' },
    ]);

    await expect(deploySite('token', fast)).resolves.toBeUndefined();
  });

  it('fails when GitHub refuses to show the run', async () => {
    github([json({ message: 'Not Found' }, 404)]);

    await expect(deploySite('token', fast)).rejects.toThrow(
      'GitHub refused the deploy run status: 404',
    );
  });

  it('fails without a token before calling GitHub', async () => {
    const calls = github([]);

    await expect(deploySite(undefined, fast)).rejects.toThrow(
      'PUBLISH_DISPATCH_TOKEN is not set',
    );
    expect(calls).toEqual([]);
  });

  it('fails when the dispatch is refused', async () => {
    globalThis.fetch = jest.fn(async () =>
      json({ message: 'Bad credentials' }, 401),
    ) as typeof fetch;

    await expect(deploySite('token', fast)).rejects.toThrow(
      'GitHub refused the deploy dispatch: 401',
    );
  });
});
