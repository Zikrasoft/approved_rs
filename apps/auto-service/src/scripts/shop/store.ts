import { PUBLISHABLE_KEY_HEADER } from '@podbor/shop-catalog/browser';

export class StoreError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    message: string,
  ) {
    super(message);
    this.name = 'StoreError';
  }
}

function backend(): { url: string; key: string } {
  const url = import.meta.env.PUBLIC_MEDUSA_BACKEND_URL;
  const key = import.meta.env.PUBLIC_MEDUSA_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      'PUBLIC_MEDUSA_BACKEND_URL and PUBLIC_MEDUSA_PUBLISHABLE_KEY were not set for this build',
    );
  }
  return { url, key };
}

export async function storeJson<T>(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    params?: Record<string, string>;
  } = {},
): Promise<T> {
  const { url, key } = backend();
  const target = new URL(path, url);
  for (const [name, value] of Object.entries(init.params ?? {}))
    target.searchParams.set(name, value);
  const response = await fetch(target, {
    method: init.method ?? 'GET',
    headers: {
      [PUBLISHABLE_KEY_HEADER]: key,
      ...(init.body !== undefined && { 'content-type': 'application/json' }),
    },
    ...(init.body !== undefined && { body: JSON.stringify(init.body) }),
  });
  if (!response.ok) {
    const { code } = (await response.json().catch(() => ({}))) as {
      code?: unknown;
    };
    throw new StoreError(
      response.status,
      typeof code === 'string' ? code : null,
      `Medusa answered ${response.status} for ${target.pathname}`,
    );
  }
  return (await response.json()) as T;
}
