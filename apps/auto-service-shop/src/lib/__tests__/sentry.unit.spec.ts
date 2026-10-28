import type { ErrorEvent } from '@sentry/node';
import * as Sentry from '@sentry/node';
import { MedusaError } from '@medusajs/framework/utils';

import { keepAdminCodes } from '../admin-errors';
import { sentryOptions } from '../sentry';

jest.mock('@sentry/node', () => ({ captureException: jest.fn() }));

const DSN = 'https://public@o1.ingest.sentry.io/1';

describe('sentryOptions', () => {
  it('turns Sentry off while SENTRY_DSN is unset or empty', () => {
    expect(sentryOptions({})).toBeNull();
    expect(sentryOptions({ SENTRY_DSN: '' })).toBeNull();
  });

  it('refuses a SENTRY_DSN that is not a URL', () => {
    expect(() => sentryOptions({ SENTRY_DSN: 'not a dsn' })).toThrow();
  });

  it('sends errors to the DSN without personal data or tracing', () => {
    const options = sentryOptions({
      SENTRY_DSN: DSN,
      NODE_ENV: 'production',
    });

    expect(options).toMatchObject({
      dsn: DSN,
      environment: 'production',
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
        databaseQueryData: false,
        queues: false,
        stackFrameVariables: false,
        graphQL: { document: false, variables: false },
        genAI: { inputs: false, outputs: false },
      },
    });
    expect(options?.tracesSampleRate).toBeUndefined();
  });

  it('strips the request, the user and the breadcrumbs from every event', () => {
    const event: ErrorEvent = {
      type: undefined,
      message: 'boom',
      request: {
        url: 'https://api.carlab.rs/store/offer-carts/1?phone=381601234567',
        headers: { authorization: 'Bearer secret', cookie: 'connect.sid=x' },
        cookies: { 'connect.sid': 'x' },
        data: { phone: '+381601234567', email: 'a@b.rs' },
        query_string: 'phone=381601234567',
      },
      user: { ip_address: '1.2.3.4', email: 'a@b.rs' },
      breadcrumbs: [{ message: 'POST /store/offer-carts phone=381601234567' }],
    };

    const sent = sentryOptions({ SENTRY_DSN: DSN })?.beforeSend?.(event, {});

    expect(sent).toEqual({ type: undefined, message: 'boom' });
  });
});

describe('the error handler', () => {
  const respond = () => {
    const res = {
      statusCode: 200,
      status: jest.fn((code: number) => {
        res.statusCode = code;
        return res;
      }),
      json: jest.fn(() => res),
      send: jest.fn(() => res),
      headersSent: false,
    };
    return res;
  };
  const handle = (error: unknown) =>
    keepAdminCodes(
      error as MedusaError,
      {
        scope: { resolve: () => ({ error: jest.fn(), info: jest.fn() }) },
      } as never,
      respond() as never,
      jest.fn(),
    );

  beforeEach(() => jest.mocked(Sentry.captureException).mockClear());

  it('reports an unexpected error', () => {
    const error = new Error('database exploded');

    handle(error);

    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it('does not report a client error', () => {
    handle(new MedusaError(MedusaError.Types.NOT_FOUND, 'no such part'));
    handle(new MedusaError(MedusaError.Types.INVALID_DATA, 'bad VIN'));

    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
