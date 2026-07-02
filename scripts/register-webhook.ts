// Одноразовый скрипт — запускать через:
// mise exec -- node --env-file=.env.local --experimental-strip-types scripts/register-webhook.ts

const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET!;
const SITE = process.env.SITE!;

if (!TOKEN || !SECRET || !SITE) {
  console.error('Missing env vars: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, SITE');
  process.exit(1);
}

const webhookUrl = `${SITE}/api/telegram`;

const response = await fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: webhookUrl,
    secret_token: SECRET,
    allowed_updates: ['callback_query'],
    drop_pending_updates: true,
  }),
});

const data = await response.json();
console.log('setWebhook result:', JSON.stringify(data, null, 2));

// Verify
const info = await fetch(`https://api.telegram.org/bot${TOKEN}/getWebhookInfo`);
const infoData = await info.json();
console.log('Webhook info:', JSON.stringify(infoData.result, null, 2));
