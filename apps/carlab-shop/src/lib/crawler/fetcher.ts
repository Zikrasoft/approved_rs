import type { IncomingHttpHeaders } from 'node:http';

import {
  Configuration,
  HttpCrawler,
  type HttpCrawlerOptions,
  type InternalHttpCrawlingContext,
  SessionError,
} from '@crawlee/http';
import {
  PlaywrightCrawler,
  type PlaywrightCrawlerOptions,
} from '@crawlee/playwright';
import type { Page } from 'playwright';

export type FetchMode = 'http' | 'browser';

export type Fetched =
  | {
      kind: 'response';
      status: number;
      headers: Record<string, string>;
      body: Buffer;
    }
  | { kind: 'blocked'; reason: string }
  | { kind: 'error'; reason: string };

export type FetchRequest = {
  url: string;
  headers?: Record<string, string>;
  waitFor?: string;
  interact?: (page: Page) => Promise<void>;
  beforeAttempt: () => Promise<void>;
};

export type Fetcher = {
  fetch: (request: FetchRequest) => Promise<Fetched>;
  close: () => Promise<void>;
};

const CHALLENGE_TITLE =
  /<title>\s*(?:just a moment\.\.\.|attention required! \| cloudflare)/iu;
const MAX_SESSION_ROTATIONS = 3;
const REQUEST_HANDLER_TIMEOUT_SECS = 120;
const WAIT_FOR_MS = 30_000;
const UNUSED_RESOURCES = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.mp4',
  '.pdf',
];

const flatHeaders = (headers: IncomingHttpHeaders): Record<string, string> =>
  Object.fromEntries(
    Object.entries(headers).flatMap(([name, value]) =>
      value === undefined
        ? []
        : [[name, Array.isArray(value) ? value.join(', ') : value]],
    ),
  );

const refusal = (headers: Record<string, string>, body: Buffer) => {
  if (headers['cf-mitigated'] === 'challenge') return 'cf-mitigated challenge';
  return CHALLENGE_TITLE.test(body.subarray(0, 4096).toString('utf8'))
    ? 'challenge page'
    : null;
};

class SitemapTolerantHttpCrawler extends HttpCrawler<InternalHttpCrawlingContext> {
  protected override isRequestBlocked(context: InternalHttpCrawlingContext) {
    if (!context.contentType.type.includes('xml')) {
      return super.isRequestBlocked(context);
    }
    return super.isRequestBlocked({
      ...context,
      contentType: { ...context.contentType, type: 'application/octet-stream' },
    });
  }
}

export const crawleeFetcher = (mode: FetchMode): Fetcher => {
  const pending = new Map<
    string,
    {
      request: FetchRequest;
      resolve: (fetched: Fetched) => void;
      answered: boolean;
    }
  >();
  let sequence = 0;

  const settle = (key: string, fetched: Fetched) => {
    pending.get(key)?.resolve(fetched);
    pending.delete(key);
  };

  const answer = (
    key: string,
    status: number,
    headers: Record<string, string>,
    body: Buffer,
  ) => {
    const refused = refusal(headers, body);
    if (refused) throw new SessionError(refused);
    settle(key, { kind: 'response', status, headers, body });
  };

  const common = {
    maxConcurrency: 1,
    keepAlive: true,
    retryOnBlocked: true,
    maxSessionRotations: MAX_SESSION_ROTATIONS,
    requestHandlerTimeoutSecs: REQUEST_HANDLER_TIMEOUT_SECS,
    sessionPoolOptions: { blockedStatusCodes: [401, 403] },
    failedRequestHandler: async (
      { request }: { request: { uniqueKey: string } },
      error: Error,
    ) =>
      settle(request.uniqueKey, {
        kind: pending.get(request.uniqueKey)?.answered ? 'blocked' : 'error',
        reason: error.message,
      }),
  };
  const beforeAttempt = async ({
    request,
  }: {
    request: { uniqueKey: string };
  }) => {
    const entry = pending.get(request.uniqueKey);
    if (!entry) return;
    entry.answered = false;
    await entry.request.beforeAttempt();
  };
  const afterAttempt = ({
    request,
    response,
  }: {
    request: { uniqueKey: string };
    response?: unknown;
  }) => {
    const entry = pending.get(request.uniqueKey);
    if (entry && response) entry.answered = true;
  };

  const config = new Configuration({ persistStorage: false });
  const crawler =
    mode === 'http'
      ? new SitemapTolerantHttpCrawler(
          {
            ...common,
            additionalMimeTypes: ['*/*'],
            ignoreHttpErrorStatusCodes: Array.from(
              { length: 100 },
              (_, index) => 500 + index,
            ),
            preNavigationHooks: [beforeAttempt],
            postNavigationHooks: [afterAttempt],
            requestHandler: async ({ request, response, body }) =>
              answer(
                request.uniqueKey,
                response.statusCode ?? 0,
                flatHeaders(response.headers),
                Buffer.isBuffer(body) ? body : Buffer.from(body),
              ),
          } satisfies HttpCrawlerOptions,
          config,
        )
      : new PlaywrightCrawler(
          {
            ...common,
            preNavigationHooks: [
              beforeAttempt,
              ({ blockRequests }) =>
                blockRequests({ urlPatterns: UNUSED_RESOURCES }),
            ],
            postNavigationHooks: [afterAttempt],
            requestHandler: async ({ request, response, page }) => {
              const { waitFor, interact } =
                pending.get(request.uniqueKey)?.request ?? {};
              if (waitFor) {
                await page.waitForSelector(waitFor, {
                  state: 'attached',
                  timeout: WAIT_FOR_MS,
                });
              }
              await interact?.(page);
              answer(
                request.uniqueKey,
                response?.status() ?? 200,
                response?.headers() ?? {},
                Buffer.from(await page.content()),
              );
            },
          } satisfies PlaywrightCrawlerOptions,
          config,
        );
  const running = crawler.run();

  return {
    fetch: (request) =>
      new Promise<Fetched>((resolve, reject) => {
        sequence += 1;
        const uniqueKey = `${sequence} ${request.url}`;
        pending.set(uniqueKey, { request, resolve, answered: false });
        crawler
          .addRequests([
            { url: request.url, uniqueKey, headers: request.headers },
          ])
          .catch((error: unknown) => {
            pending.delete(uniqueKey);
            reject(error);
          });
      }),
    close: async () => {
      crawler.stop();
      await running;
    },
  };
};
