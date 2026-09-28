import type { Env } from './env';

export const DISPATCH_URL =
  'https://api.github.com/repos/Zikrasoft/approved_rs/actions/workflows/ci.yml/dispatches';

export const DISPATCH_REF = 'main';

type Logger = Pick<Console, 'info' | 'error'>;

export type DispatchTarget = { url: string; token: string; ref: string };

export function dispatchTarget(
  env: Pick<Env, 'GITHUB_DISPATCH_TOKEN'>,
): DispatchTarget | undefined {
  return env.GITHUB_DISPATCH_TOKEN
    ? { url: DISPATCH_URL, token: env.GITHUB_DISPATCH_TOKEN, ref: DISPATCH_REF }
    : undefined;
}

export type Send = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number }>;

export type BuildOutcome =
  'started' | 'not-configured' | 'unauthorised' | 'refused';

async function defaultSend(
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
): Promise<{ ok: boolean; status: number }> {
  const response = await fetch(url, init);
  return { ok: response.ok, status: response.status };
}

export async function requestBuild(deps: {
  target?: DispatchTarget;
  logger: Logger;
  send?: Send;
}): Promise<BuildOutcome> {
  if (!deps.target) {
    return 'not-configured';
  }
  const send = deps.send ?? defaultSend;

  try {
    const response = await send(deps.target.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'carlab-medusa',
        authorization: `Bearer ${deps.target.token}`,
      },
      body: JSON.stringify({ ref: deps.target.ref }),
    });
    if (response.ok) {
      return 'started';
    }
    deps.logger.error(`Build request answered ${response.status}`);
    return response.status === 401 || response.status === 403
      ? 'unauthorised'
      : 'refused';
  } catch (error) {
    deps.logger.error(`Build request unreachable: ${String(error)}`);
    return 'refused';
  }
}

export type RebuildScheduler = {
  schedule(event: string): void;
  pending(): boolean;
};

export function createRebuildScheduler(deps: {
  target?: DispatchTarget;
  configured: boolean;
  debounceMs: number;
  logger: Logger;
  send?: Send;
}): RebuildScheduler {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let complained = false;
  let events = new Set<string>();

  async function fire(): Promise<void> {
    timer = undefined;
    const batch = events;
    events = new Set();
    const outcome = await requestBuild({
      target: deps.target,
      logger: deps.logger,
      send: deps.send,
    });
    if (outcome === 'started') {
      deps.logger.info(`Rebuild requested for ${batch.size} event(s)`);
    }
  }

  return {
    schedule(event: string): void {
      if (!deps.configured) {
        return;
      }
      if (!deps.target) {
        if (!complained) {
          complained = true;
          deps.logger.error(
            'REBUILD_ON_CATALOG_EVENTS is on, but GITHUB_DISPATCH_TOKEN is not set — no build would ever start.',
          );
        }
        return;
      }
      events.add(event);
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => void fire(), deps.debounceMs);
      timer.unref?.();
    },
    pending: () => timer !== undefined,
  };
}
