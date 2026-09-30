import { existsSync } from 'node:fs';
import { buildSearchIndex } from '../src/lib/searchIndex.ts';
import { readShopStatus, shopBuilt } from '../src/utils/shopStatus.ts';

if (!shopBuilt(readShopStatus(process.env))) {
  console.log('[search] the shop is off — no index');
  process.exit(0);
}

const outputs = [
  'dist/client/pagefind',
  ...(existsSync('.vercel/output/static')
    ? ['.vercel/output/static/pagefind']
    : []),
];
const { languages } = await buildSearchIndex('dist/client', outputs);
console.log('[search] indexed', languages, 'into', outputs.join(', '));
