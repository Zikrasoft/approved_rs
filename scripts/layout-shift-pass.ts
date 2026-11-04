import { chromium, devices, type BrowserContext } from '@playwright/test';

const BASE = process.argv[2];
const PATHS = process.argv.slice(3);
const BUDGET = 0.01;

if (!BASE || PATHS.length === 0) {
  console.error(
    'usage: layout-shift-pass.ts <base-url> <path> [<path>...]\n' +
      '  e.g. layout-shift-pass.ts http://localhost:4321 /ru/ /ru/parts/',
  );
  process.exit(2);
}

interface Shift {
  value: number;
  input: boolean;
  sources: string[];
}

const recordShifts = () => {
  const log: Shift[] = [];
  Object.assign(window, { layoutShifts: log });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as unknown as Array<{
      value: number;
      hadRecentInput: boolean;
      sources: Array<{
        node?: Node;
        previousRect: DOMRectReadOnly;
        currentRect: DOMRectReadOnly;
      }>;
    }>) {
      log.push({
        value: entry.value,
        input: entry.hadRecentInput,
        sources: entry.sources.map(({ node, previousRect, currentRect }) => {
          const el = node instanceof Element ? node : node?.parentElement;
          const name = el
            ? `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 3).join('.')}`
            : '#text';
          return `${name} (${Math.round(previousRect.x)},${Math.round(previousRect.y)})→(${Math.round(currentRect.x)},${Math.round(currentRect.y)})`;
        }),
      });
    }
  }).observe({ type: 'layout-shift', buffered: true });
};

async function measure(context: BrowserContext, path: string) {
  const page = await context.newPage();
  try {
    const response = await page.goto(`${BASE}${path}`, { waitUntil: 'load' });
    if (!response?.ok())
      throw new Error(`${path} → ${response?.status() ?? 'no response'}`);
    await page.waitForTimeout(1500);
    const height = await page.evaluate(() => document.body.scrollHeight);
    for (const direction of [1, -1])
      for (let y = 0; y < Math.min(height, 4000); y += 300) {
        await page.mouse.wheel(0, 300 * direction);
        await page.waitForTimeout(80);
      }
    await page.waitForTimeout(500);
    return await page.evaluate(
      () => (window as unknown as { layoutShifts: Shift[] }).layoutShifts,
    );
  } finally {
    await page.close();
  }
}

const browser = await chromium.launch();
const contexts = {
  'desktop 1440': { viewport: { width: 1440, height: 900 } },
  'desktop 1280': { viewport: { width: 1280, height: 800 } },
  'Pixel 7': devices['Pixel 7'],
};

let failed = false;

for (const [label, options] of Object.entries(contexts)) {
  const context = await browser.newContext(options);
  await context.addInitScript(recordShifts);
  console.log(`\n## ${label}`);
  for (const path of PATHS) {
    const shifts = await measure(context, path);
    const cls = shifts
      .filter((shift) => !shift.input)
      .reduce((sum, shift) => sum + shift.value, 0);
    const over = cls > BUDGET;
    console.log(`${over ? 'FAIL' : 'ok  '} ${path}  CLS ${cls.toFixed(4)}`);
    for (const shift of shifts)
      console.log(
        `       ${shift.value.toFixed(4)}${shift.input ? ' (input)' : ''} ${shift.sources.join('; ')}`,
      );
    if (over) failed = true;
  }
  await context.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
