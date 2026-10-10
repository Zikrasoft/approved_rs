import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import type { StoredLead } from '@podbor/lead-crm';
import {
  ORDER_HOOK_HEADER,
  signHook,
  type OrderHookPayload,
} from '@podbor/shop-catalog/order-hook';

const DATA_DIR = '.local-data';
const FUNNEL_DIR = `${DATA_DIR}/funnel`;
const TELEGRAM_LOG = `${FUNNEL_DIR}/telegram.jsonl`;
const TELEGRAM_FAIL = `${FUNNEL_DIR}/telegram-fail`;
const LEADS_FILE = `${DATA_DIR}/data/leads.json`;
const MARKERS_DIR = `${DATA_DIR}/shop-orders`;

const BUYER = {
  name: 'Funnel Walker',
  email: 'funnel.walk@example.com',
  typedPhone: '641234567',
  phone: '+381641234567',
};

interface TelegramCall {
  method: string;
  failed: boolean;
  body: string | null;
}

interface OwnerCard {
  chat_id: string;
  text: string;
  parse_mode: string;
  reply_markup: { inline_keyboard: { text: string; url: string }[][] };
}

const telegramCalls = (): TelegramCall[] =>
  existsSync(TELEGRAM_LOG)
    ? readFileSync(TELEGRAM_LOG, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line): TelegramCall => JSON.parse(line))
    : [];

const cardsSentSince = (seen: number): TelegramCall[] =>
  telegramCalls()
    .slice(seen)
    .filter((call) => call.method === 'sendMessage');

const leads = (): StoredLead[] =>
  existsSync(LEADS_FILE) ? JSON.parse(readFileSync(LEADS_FILE, 'utf8')) : [];

const markerFiles = (): string[] =>
  existsSync(MARKERS_DIR) ? readdirSync(MARKERS_DIR) : [];

const markerOrderIds = (): string[] =>
  markerFiles().map(
    (file): string =>
      JSON.parse(readFileSync(`${MARKERS_DIR}/${file}`, 'utf8')).orderId,
  );

async function buyOneBattery(page: Page): Promise<number> {
  await page.goto('/ru/shop/batteries/');
  const hrefs = await page
    .locator('[data-product] a[href*="/shop/batteries/"]')
    .evaluateAll((nodes) => [
      ...new Set(nodes.map((node) => node.getAttribute('href') ?? '')),
    ]);
  expect(hrefs.length).toBeGreaterThan(0);
  await page.goto(hrefs[0]);
  await page.locator('button[data-add]').waitFor();

  let bought = false;
  for (const href of hrefs) {
    await page.goto(href);
    const add = page.locator('button[data-add]');
    if (!(await add.isEnabled())) continue;
    const goCart = page.locator('[data-go-cart]');
    await expect(async () => {
      await add.click();
      await expect(goCart).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
    await goCart.click();
    bought = true;
    break;
  }
  if (!bought) throw new Error('every seeded battery is out of stock');

  const form = page.locator('checkout-form form');
  await expect(form).toBeVisible();
  await form.locator('input[name="name"]').fill(BUYER.name);
  await form.locator('input[name="email"]').fill(BUYER.email);
  await form.locator('[data-phone]').fill(BUYER.typedPhone);
  await form.locator('[data-consent]').check();
  await form.locator('button[type="submit"]').click();

  await expect(page.locator('[data-placed]')).toBeVisible({ timeout: 60_000 });
  const heading = await page.locator('[data-placed-heading]').innerText();
  const displayId = Number(/\d+/.exec(heading)?.[0]);
  expect(displayId).toBeGreaterThan(0);
  return displayId;
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  rmSync(DATA_DIR, { recursive: true, force: true });
});

test.afterAll(() => {
  rmSync(TELEGRAM_FAIL, { force: true });
});

test('one order leaves one lead, one marker and one owner card', async ({
  page,
}) => {
  const displayId = await buyOneBattery(page);

  await expect
    .poll(markerFiles, {
      timeout: 60_000,
      message: 'the order hook never reached the storefront',
    })
    .toHaveLength(1);
  await expect.poll(leads, { timeout: 60_000 }).toHaveLength(1);

  const [lead] = leads();
  expect(lead.brand).toBe('CarLab');
  expect(lead.service).toBe('parts-order');
  expect(lead.visitorId).toBeNull();
  expect(lead.name).toBe(BUYER.name);
  expect(lead.contact).toBe(BUYER.phone);
  expect(lead.locale).toBe('ru');
  expect(lead.comment).toContain(`Заказ #${displayId}`);
  expect(lead.telegramMessageId).not.toBeNull();

  const sent = cardsSentSince(0);
  expect(sent).toHaveLength(1);
  const card: OwnerCard = JSON.parse(sent[0].body ?? 'null');
  expect(card.chat_id).toBe(process.env.TELEGRAM_GROUP_ID);
  expect(card.parse_mode).toBe('HTML');
  expect(card.text).toContain(BUYER.name);
  expect(card.text).toContain('Заказ из магазина');
  expect(card.reply_markup.inline_keyboard[0][0].url).toContain(
    `lead_${lead.id}`,
  );
});

test('a refused card holds the marker and the retry answers as a duplicate', async ({
  page,
  request,
}) => {
  const secret = process.env.SHOP_ORDER_HOOK_SECRET;
  if (!secret) throw new Error('SHOP_ORDER_HOOK_SECRET is not set');

  writeFileSync(TELEGRAM_FAIL, '');
  const seenCalls = telegramCalls().length;
  const seenOrders = markerOrderIds();

  const displayId = await buyOneBattery(page);

  await expect.poll(markerFiles, { timeout: 60_000 }).toHaveLength(2);
  await expect.poll(leads, { timeout: 60_000 }).toHaveLength(2);

  const lead = leads().find((row) =>
    (row.comment ?? '').includes(`Заказ #${displayId}`),
  );
  expect(lead).toBeDefined();
  expect(lead?.telegramMessageId).toBeNull();

  const refused = cardsSentSince(seenCalls);
  expect(refused).toHaveLength(1);
  expect(refused[0].failed).toBe(true);

  const orderId = markerOrderIds().find((id) => !seenOrders.includes(id));
  expect(orderId).toBeDefined();

  const payload: OrderHookPayload = {
    orderId: orderId ?? '',
    displayId,
    locale: 'ru',
    customer: { name: BUYER.name, phone: BUYER.phone, email: BUYER.email },
    items: [
      { title: 'Retried order', quantity: 1, unitPrice: 0, isService: false },
    ],
    total: 0,
    adminUrl: `https://api.carlab.rs/app/orders/${orderId}`,
  };
  const body = JSON.stringify(payload);
  const response = await request.post('/api/shop-order', {
    headers: {
      'content-type': 'application/json',
      [ORDER_HOOK_HEADER]: signHook(body, secret),
    },
    data: body,
  });

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ duplicate: true });
  expect(leads()).toHaveLength(2);
  expect(markerFiles()).toHaveLength(2);
  expect(cardsSentSince(seenCalls)).toHaveLength(1);
});
