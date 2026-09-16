import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { sha256Hex } from './sha256Hex.ts';

export type CacheBlock = Record<string, string>;
export type CacheFile = Record<string, CacheBlock>;

export const DEFAULT_CACHE_PATH = 'src/content/translations.cache.json';

const cacheFileSchema = z.record(z.string(), z.record(z.string(), z.string()));

const collapseWhitespace = (text: string): string =>
  text.replace(/\s+/g, ' ').trim();

export function promptFingerprint(systemPrompt: string, model: string): string {
  return sha256Hex(JSON.stringify([collapseWhitespace(systemPrompt), model]));
}

export function leafKey(fingerprint: string, sourceText: string): string {
  return sha256Hex(`${fingerprint}\n${sourceText}`);
}

export function blockIsEmpty(block: CacheBlock): boolean {
  return Object.keys(block).length === 0;
}

export function loadCache(cachePath: string): CacheFile {
  let raw: string;
  try {
    raw = readFileSync(cachePath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    return {};
  }
  const parsed = cacheFileSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) throw new Error(`${cachePath}: not a translation cache`);
  return parsed.data;
}

export function saveCache(cachePath: string, cache: CacheFile): void {
  const sorted: CacheFile = {};
  for (const path of Object.keys(cache).sort()) {
    const block = cache[path] as CacheBlock;
    const sortedBlock: CacheBlock = {};
    for (const key of Object.keys(block).sort()) {
      sortedBlock[key] = block[key] as string;
    }
    sorted[path] = sortedBlock;
  }
  writeFileSync(cachePath, `${JSON.stringify(sorted, null, 2)}\n`);
}

export function pruneMissingFiles(cache: CacheFile): void {
  for (const path of Object.keys(cache)) {
    if (!existsSync(path)) delete cache[path];
  }
}
