const BOT_AGENT =
  /(?<!cu)bot|crawl|spider|slurp|externalhit|headless|lighthouse|python-|curl\/|wget|go-http-client|axios|node-fetch|scrapy|whatsapp|monitor|uptime/i;

export const isBotAgent = (userAgent: string | null): boolean =>
  !userAgent || BOT_AGENT.test(userAgent);
