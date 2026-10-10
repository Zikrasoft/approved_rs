import { Bot, type ApiClientOptions } from 'grammy';

const globalFetch: typeof fetch = (...args) => globalThis.fetch(...args);
const clientFetch = globalFetch as unknown as ApiClientOptions['fetch'];

export function createCaptureBot(token: string, username: string): Bot {
  return new Bot(token, {
    client: { fetch: clientFetch },
    botInfo: {
      id: Number(token.split(':')[0]),
      is_bot: true,
      first_name: username,
      username,
      can_join_groups: false,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
      can_connect_to_business: false,
      has_main_web_app: false,
      has_topics_enabled: false,
      allows_users_to_create_topics: false,
      can_manage_bots: false,
      supports_join_request_queries: false,
    },
  });
}
