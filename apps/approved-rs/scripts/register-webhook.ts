import { z } from 'zod';

const BOTS = {
  crm: {
    tokenVar: 'TELEGRAM_BOT_TOKEN',
    secretVar: 'TELEGRAM_WEBHOOK_SECRET',
    path: '/api/telegram-webhook',
  },
  capture: {
    tokenVar: 'TELEGRAM_CAPTURE_BOT_TOKEN',
    secretVar: 'TELEGRAM_CAPTURE_WEBHOOK_SECRET',
    path: '/api/telegram-capture',
  },
} as const;

const botNameSchema = z.enum(['crm', 'capture']);

const USAGE = `Usage: node --env-file=.env.local --experimental-strip-types scripts/register-webhook.ts <${botNameSchema.options.join('|')}>`;

const botName = botNameSchema.safeParse(process.argv[2]);
if (!botName.success) {
  console.error(`Unknown bot: ${process.argv[2] ?? '(none given)'}`);
  console.error(USAGE);
  process.exit(1);
}

const bot = BOTS[botName.data];

const env = z
  .object({
    token: z.string().min(1),
    secret: z.string().min(1),
    site: z.url(),
  })
  .safeParse({
    token: process.env[bot.tokenVar],
    secret: process.env[bot.secretVar],
    site: process.env.SITE,
  });

if (!env.success) {
  const varNames = { token: bot.tokenVar, secret: bot.secretVar, site: 'SITE' };
  for (const issue of env.error.issues) {
    const key = issue.path[0] as keyof typeof varNames;
    console.error(`${varNames[key]}: ${issue.message}`);
  }
  process.exit(1);
}

const { token, secret, site } = env.data;
const webhookUrl = `${site}${bot.path}`;

console.log(`Registering the ${botName.data} bot's webhook at ${webhookUrl}`);

const response = await fetch(
  `https://api.telegram.org/bot${token}/setWebhook`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ['callback_query', 'message'],
      drop_pending_updates: true,
    }),
  },
);

const data = await response.json();
console.log('setWebhook result:', JSON.stringify(data, null, 2));

const info = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
const infoData = await info.json();
console.log('Webhook info:', JSON.stringify(infoData.result, null, 2));
