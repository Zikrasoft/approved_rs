import { appendFileSync, existsSync, mkdirSync } from 'node:fs';

const DIR = '.local-data/funnel';
const LOG = `${DIR}/telegram.jsonl`;
const FAIL = `${DIR}/telegram-fail`;
const API = 'https://api.telegram.org/';

const realFetch = globalThis.fetch;
let messageId = 9000;

const urlOf = (input: RequestInfo | URL): string =>
  typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input.url;

globalThis.fetch = async (input, init) => {
  const url = urlOf(input);
  if (!url.startsWith(API)) return realFetch(input, init);

  const method = url.slice(url.lastIndexOf('/') + 1);
  const failed = existsSync(FAIL);
  mkdirSync(DIR, { recursive: true });
  appendFileSync(
    LOG,
    `${JSON.stringify({
      method,
      failed,
      body: typeof init?.body === 'string' ? init.body : null,
    })}\n`,
  );

  if (failed) {
    return Response.json(
      { ok: false, description: 'funnel walk forced this failure' },
      { status: 500 },
    );
  }
  messageId += 1;
  return Response.json({
    ok: true,
    result:
      method === 'sendMessage'
        ? {
            message_id: messageId,
            chat: { id: Number(process.env.TELEGRAM_GROUP_ID) || 1 },
          }
        : true,
  });
};
