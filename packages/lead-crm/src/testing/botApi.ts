export interface BotApiCall {
  token: string;
  method: string;
  payload: Record<string, unknown>;
}

export type BotApiResponse =
  | { ok: true; result: unknown }
  | { ok: false; error_code: number; description: string };

type Responder = (payload: Record<string, unknown>) => BotApiResponse;

const URL_PATTERN = /\/bot([^/]+)\/([A-Za-z]+)$/;
const NUMERIC_ID = /^-?\d+$/;

function chatIdOf(value: unknown): unknown {
  return typeof value === 'string' && NUMERIC_ID.test(value)
    ? Number(value)
    : value;
}

export function recordBotApi() {
  const calls: BotApiCall[] = [];
  const responders = new Map<string, Responder>();
  let nextMessageId = 1000;

  function defaultResponse(
    method: string,
    payload: Record<string, unknown>,
  ): BotApiResponse {
    if (method === 'getMe')
      return {
        ok: true,
        result: {
          id: 1,
          is_bot: true,
          first_name: 'Bot',
          username: 'bot',
          can_join_groups: true,
          can_read_all_group_messages: false,
          supports_inline_queries: false,
        },
      };
    if (method.startsWith('send') || method === 'editMessageText')
      return {
        ok: true,
        result: {
          message_id:
            method === 'editMessageText' ? payload.message_id : nextMessageId++,
          date: 0,
          chat: { id: chatIdOf(payload.chat_id), type: 'private' },
          text: payload.text,
        },
      };
    return { ok: true, result: true };
  }

  async function fetch(
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> {
    const url = input instanceof Request ? input.url : String(input);
    const match = URL_PATTERN.exec(url);
    if (!match) throw new Error(`recordBotApi: not a Bot API URL: ${url}`);
    const [, token, method] = match;
    const payload = init?.body
      ? (JSON.parse(String(init.body)) as Record<string, unknown>)
      : {};
    calls.push({ token, method, payload });
    const responder = responders.get(method);
    const body = responder
      ? responder(payload)
      : defaultResponse(method, payload);
    return new Response(JSON.stringify(body), {
      status: body.ok ? 200 : body.error_code,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return {
    fetch,
    calls,
    callsTo(method: string, token?: string) {
      return calls.filter(
        (c) =>
          c.method === method && (token === undefined || c.token === token),
      );
    },
    respond(method: string, result: unknown | Responder) {
      responders.set(method, (payload) =>
        typeof result === 'function'
          ? (result as Responder)(payload)
          : { ok: true, result },
      );
    },
    fail(method: string, description: string, errorCode = 400) {
      responders.set(method, () => ({
        ok: false,
        error_code: errorCode,
        description,
      }));
    },
    reset() {
      calls.length = 0;
      responders.clear();
    },
  };
}

export type RecordedBotApi = ReturnType<typeof recordBotApi>;
