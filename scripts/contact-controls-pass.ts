import { chromium, devices, type BrowserContext } from '@playwright/test';

const BASE = process.argv[2];
const PATHS = process.argv.slice(3);

if (!BASE || PATHS.length === 0) {
  console.error(
    'usage: contact-controls-pass.ts <base-url> <path> [<path>...]\n' +
      '  e.g. contact-controls-pass.ts http://localhost:4321 /ru/thanks/ /ru/contacts/',
  );
  process.exit(2);
}

interface Probe {
  pointerFine: boolean;
  placements: string[];
  visibleTel: string[];
  focusableTel: number;
  plainNumbers: string[];
  orphans: string[];
}

async function probe(context: BrowserContext, path: string): Promise<Probe> {
  const page = await context.newPage();
  try {
    const response = await page.goto(`${BASE}${path}`, { waitUntil: 'load' });
    if (!response?.ok())
      throw new Error(`${path} → ${response?.status() ?? 'no response'}`);
    return await page.evaluate(() => {
      const region = (el: Element) =>
        el.closest<HTMLElement>('[data-contact-placement]')?.dataset
          .contactPlacement ?? 'ORPHAN';
      const shown = (el: Element) => (el as HTMLElement).checkVisibility();
      const tel = [...document.querySelectorAll('a[href^="tel:"]')];
      return {
        pointerFine: matchMedia('(pointer: fine)').matches,
        placements: [
          ...new Set(
            [
              ...document.querySelectorAll<HTMLElement>(
                '[data-contact-placement]',
              ),
            ].map((el) => el.dataset.contactPlacement!),
          ),
        ],
        visibleTel: tel.filter(shown).map(region),
        focusableTel: tel.filter(
          (el) => (el as HTMLElement).offsetParent !== null,
        ).length,
        plainNumbers: [
          ...document.querySelectorAll('.pointer-coarse\\:hidden\\!'),
        ]
          .filter(shown)
          .map((el) => `${region(el)}=${el.textContent?.trim().slice(0, 24)}`),
        orphans: [...document.querySelectorAll('[data-contact-channel]')]
          .filter((el) => !el.closest('[data-contact-placement]'))
          .map((el) => (el as HTMLElement).dataset.contactChannel!),
      };
    });
  } finally {
    await page.close();
  }
}

const browser = await chromium.launch();
// A resized window stops at Chrome's minimum width and still reports a fine
// pointer, so coarse comes from a device profile — the DevTools emulation path.
const contexts = {
  'fine (desktop)': await browser.newContext({
    viewport: { width: 1440, height: 900 },
  }),
  'coarse (iPhone 15)': await browser.newContext(devices['iPhone 15']),
};

let failed = false;

for (const [label, context] of Object.entries(contexts)) {
  console.log(`\n## ${label}`);
  for (const path of PATHS) {
    const result = await probe(context, path);
    const coarse = !result.pointerFine;
    const problems: string[] = [];

    if (result.orphans.length > 0)
      problems.push(`no placement on: ${result.orphans.join(', ')}`);
    if (!coarse && result.visibleTel.length > 0)
      problems.push(
        `tel: link offered to a mouse in ${result.visibleTel.join(', ')}`,
      );
    if (!coarse && result.focusableTel > 0)
      problems.push(
        `${result.focusableTel} tel: link(s) still in the tab order`,
      );
    if (coarse && result.plainNumbers.length > 0)
      problems.push(
        `fine-only markup shown on a touchscreen: ${result.plainNumbers.join(', ')}`,
      );

    const state = coarse
      ? `tel: ${result.visibleTel.length}`
      : `plain number ${result.plainNumbers.length}`;
    console.log(
      `${problems.length === 0 ? 'ok  ' : 'FAIL'} ${path}  [${result.placements.join(' ')}]  ${state}`,
    );
    for (const problem of problems) console.log(`       ${problem}`);
    if (problems.length > 0) failed = true;
  }
}

await browser.close();
process.exit(failed ? 1 : 0);
