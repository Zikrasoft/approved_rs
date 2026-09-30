import type { ShopStatus } from '@/utils/shopStatus';

export async function catalogVersionText(
  status: ShopStatus,
  version: () => Promise<string>,
): Promise<string> {
  return `${status === 'off' ? 'disabled' : await version()}\n`;
}
