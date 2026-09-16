import { isPlainObject } from '../isPlainObject.ts';
import { assertSafeTranslation } from './assertSafeTranslation.ts';
import { errorMessage } from './errorMessage.ts';
import { leafKey, promptFingerprint, type CacheBlock } from './leafCache.ts';
import { callOpenAiJson, DEFAULT_TRANSLATE_MODEL } from './openaiChat.ts';

export interface Leaf {
  path: string;
  text: string;
  committed: string | undefined;
}

const MAX_REQUEST_CHARS = 8_000;
const CHUNK_ATTEMPTS = 3;

const PATH_SYNTAX = /[[\].\\]/g;

const escapeKey = (key: string): string => key.replace(PATH_SYNTAX, '\\$&');

const childPath = (path: string, key: string): string =>
  path ? `${path}.${escapeKey(key)}` : escapeKey(key);

export function collectLeaves(
  source: unknown,
  existing?: unknown,
  path = '',
): Leaf[] {
  if (typeof source === 'string')
    return [
      {
        path,
        text: source,
        committed: typeof existing === 'string' ? existing : undefined,
      },
    ];
  if (Array.isArray(source)) {
    const pairsByPosition =
      Array.isArray(existing) && existing.length === source.length;
    return source.flatMap((item, index) =>
      collectLeaves(
        item,
        pairsByPosition ? existing[index] : undefined,
        `${path}[${index}]`,
      ),
    );
  }
  if (isPlainObject(source))
    return Object.entries(source).flatMap(([key, value]) =>
      collectLeaves(
        value,
        isPlainObject(existing) ? existing[key] : undefined,
        childPath(path, key),
      ),
    );
  return [];
}

export function assemble(
  source: unknown,
  byPath: ReadonlyMap<string, string>,
  path = '',
): unknown {
  if (typeof source === 'string') return byPath.get(path) ?? source;
  if (Array.isArray(source))
    return source.map((item, index) =>
      assemble(item, byPath, `${path}[${index}]`),
    );
  if (isPlainObject(source))
    return Object.fromEntries(
      Object.entries(source).map(([key, value]) => [
        key,
        assemble(value, byPath, childPath(path, key)),
      ]),
    );
  return source;
}

export function chunkLeaves(
  leaves: readonly Leaf[],
  maxChars: number,
): Leaf[][] {
  const chunks: Leaf[][] = [];
  let current: Leaf[] = [];
  let size = 0;

  for (const leaf of leaves) {
    const cost = JSON.stringify({ [leaf.path]: leaf.text }).length;
    if (current.length > 0 && size + cost > maxChars) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(leaf);
    size += cost;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

export function leavesToPayload(
  leaves: readonly Leaf[],
): Record<string, string> {
  return Object.fromEntries(leaves.map((leaf) => [leaf.path, leaf.text]));
}

export interface TranslateLeavesParams {
  source: unknown;
  existing: unknown;
  block: CacheBlock;
  translationsAreCurrent: boolean;
  neverTranslated: boolean;
  systemPrompt: string;
  apiKey: string;
  model?: string;
}

export interface TranslateLeavesResult {
  value: unknown;
  used: Set<string>;
  requests: number;
}

export async function translateLeaves({
  source,
  existing,
  block,
  translationsAreCurrent,
  neverTranslated,
  systemPrompt,
  apiKey,
  model,
}: TranslateLeavesParams): Promise<TranslateLeavesResult> {
  const fingerprint = promptFingerprint(
    systemPrompt,
    model ?? DEFAULT_TRANSLATE_MODEL,
  );
  const leaves = collectLeaves(source, existing);
  const used = new Set<string>();
  const byPath = new Map<string, string>();
  const misses: Leaf[] = [];
  const asked = new Set<string>();

  for (const leaf of leaves) {
    if (leaf.text.trim() === '') continue;
    const key = leafKey(fingerprint, leaf.text);
    used.add(key);

    const cached = block[key];
    const adopted = adoptable(
      leaf,
      cached,
      translationsAreCurrent,
      neverTranslated,
    );
    if (adopted !== undefined) {
      block[key] = adopted;
      byPath.set(leaf.path, adopted);
      continue;
    }
    if (cached !== undefined) {
      if (passesOrWarns(leaf, cached, 'discarding cached')) {
        byPath.set(leaf.path, cached);
        continue;
      }
      delete block[key];
    }
    if (asked.has(key)) continue;
    asked.add(key);
    misses.push(leaf);
  }

  let requests = 0;
  for (const chunk of chunkLeaves(misses, MAX_REQUEST_CHARS)) {
    const payload = leavesToPayload(chunk);
    let lastError: unknown;
    let done = false;
    for (let attempt = 0; attempt < CHUNK_ATTEMPTS; attempt++) {
      requests += 1;
      try {
        const raw = await callOpenAiJson({
          apiKey,
          model,
          systemPrompt,
          userContent: JSON.stringify(payload),
        });
        assertSafeTranslation(payload, raw, '');
        const translated = raw as Record<string, string>;
        for (const leaf of chunk) {
          const value = translated[leaf.path] as string;
          block[leafKey(fingerprint, leaf.text)] = value;
          byPath.set(leaf.path, value);
        }
        done = true;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!done) throw lastError;
  }

  for (const leaf of leaves) {
    if (byPath.has(leaf.path)) continue;
    const translatedElsewhere = block[leafKey(fingerprint, leaf.text)];
    if (translatedElsewhere !== undefined)
      byPath.set(leaf.path, translatedElsewhere);
  }

  return { value: assemble(source, byPath), used, requests };
}

function passesOrWarns(leaf: Leaf, candidate: string, action: string): boolean {
  try {
    assertSafeTranslation(leaf.text, candidate, leaf.path);
    return true;
  } catch (error) {
    console.warn(`[i18n] ${action} ${leaf.path}: ${errorMessage(error)}`);
    return false;
  }
}

function adoptable(
  leaf: Leaf,
  cached: string | undefined,
  translationsAreCurrent: boolean,
  neverTranslated: boolean,
): string | undefined {
  if (leaf.committed === undefined || leaf.committed === cached)
    return undefined;
  if (!translationsAreCurrent) {
    if (cached !== undefined) {
      console.warn(
        `[i18n] overwriting hand-written ${leaf.path}: the file's Russian changed`,
      );
    }
    return undefined;
  }
  if (cached === undefined && !neverTranslated) return undefined;
  return passesOrWarns(leaf, leaf.committed, 'ignoring hand-written')
    ? leaf.committed
    : undefined;
}
