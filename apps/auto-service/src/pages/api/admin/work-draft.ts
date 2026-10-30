export const prerender = false;

import type { APIContext } from 'astro';
import { stringify } from 'yaml';
import { SERVICE_LABELS_RU } from '@podbor/brands';
import {
  orderCaseSummaryResponseSchema,
  type OrderCaseSummary,
} from '@podbor/catalog-contract';
import { requireEnv } from '@podbor/lead-crm';
import {
  createGithubContents,
  GithubApiError,
  KEYSTATIC_AUTH_COOKIE,
} from '@podbor/site-kit/github-contents';
import { catalogueIdSchema } from '@/utils/catalogue';
import { PARTS_SOURCING } from '@/utils/works';

const SHOP_TIMEOUT_MS = 15_000;

const SHOP_REFUSALS: Record<number, string> = {
  404: 'Заказ не найден в магазине',
  409: 'Заказ еще не завершен',
};

const github = createGithubContents({
  repo: 'Zikrasoft/approved_rs',
  branch: 'main',
  appRoot: 'apps/auto-service/',
  userAgent: 'carlab-admin',
});

async function draftExists(token: string, path: string): Promise<boolean> {
  try {
    await github.getFile(token, path);
    return true;
  } catch (error) {
    if (error instanceof GithubApiError && error.status === 404) return false;
    throw error;
  }
}

function draftWork({ car, parts, total_rsd }: OrderCaseSummary): string {
  const carName = car ? `${car.make} ${car.model}` : '';
  const label = SERVICE_LABELS_RU[PARTS_SOURCING];
  const frontmatter = stringify({
    title: carName ? `${label}: ${carName}` : label,
    car: carName,
    ...(car?.year ? { year: car.year } : {}),
    servicesApplied: [PARTS_SOURCING],
    parts,
    ...(total_rsd ? { priceRsd: total_rsd } : {}),
    gallery: [],
    date: new Date().toISOString().slice(0, 10),
    published: false,
  });
  return `---\n${frontmatter}---\n`;
}

export async function POST({
  request,
  cookies,
}: APIContext): Promise<Response> {
  const token = cookies.get(KEYSTATIC_AUTH_COOKIE)?.value;
  if (!token) {
    return new Response('Открой эту страницу через Keystatic', { status: 401 });
  }
  const order = catalogueIdSchema.safeParse(
    (await request.formData()).get('order'),
  );
  if (!order.success) {
    return new Response('Bad order id', { status: 400 });
  }
  if (!(await github.canWrite(token))) {
    return new Response('Войди в Keystatic заново', { status: 401 });
  }

  const shop = await fetch(
    new URL(
      `/hooks/carlab-orders/${order.data}/case-summary`,
      import.meta.env.MEDUSA_BACKEND_URL,
    ),
    {
      headers: { authorization: `Bearer ${requireEnv('SHOP_LEAD_SECRET')}` },
      signal: AbortSignal.timeout(SHOP_TIMEOUT_MS),
    },
  );
  if (!shop.ok) {
    const refusal = SHOP_REFUSALS[shop.status];
    return refusal
      ? new Response(refusal, { status: shop.status })
      : new Response('Магазин не ответил', { status: 502 });
  }
  const { summary } = orderCaseSummaryResponseSchema.parse(await shop.json());

  const slug = `parts-sourcing-${summary.display_id}`;
  const path = `src/content/works/${slug}/index.md`;
  if (!(await draftExists(token, path))) {
    await github.commitFiles(token, {
      files: [{ path, content: draftWork(summary) }],
      message: `Draft the ${slug} case study from shop Order ${summary.display_id}`,
    });
  }
  return new Response(null, {
    status: 303,
    headers: {
      location: `/keystatic/branch/main/collection/works/item/${slug}`,
    },
  });
}
