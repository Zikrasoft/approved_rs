// Prototype for /admin/case-photos — lets the admin multi-select gallery photos
// in one native <input multiple>, instead of Keystatic's gallery array field
// (one file picker per photo, add-item-per-photo). See keystatic.config.ts's
// `gallery: fields.array(caseImage(), ...)` for the field this works around.
//
// No YAML library: Keystatic always writes this frontmatter shape itself
// (plain string paths, `gallery:` immediately after `image:`, omitted
// entirely when empty — see any src/content/cases/*/index.md), so a couple
// of targeted line ops cover it without a new dependency.

// Same cookie Keystatic itself sets after a manager completes GitHub OAuth
// login (see keystatic.config.ts's github storage mode) — not httpOnly,
// Keystatic's own client reads it directly. Arriving with it set proves the
// request came from someone who's actually logged into Keystatic; a direct
// hit on this page with no cookie hasn't. Shared by admin/case-photos.astro
// (page-level gate) and its API route (write-level gate, and also the
// GitHub API bearer token in prod — see src/lib/githubContents.ts).
export const KEYSTATIC_AUTH_COOKIE = 'keystatic-gh-access-token';

// `collection` matches the keys exported from src/content.config.ts — the
// page uses it to call getCollection(); `dir` is the on-disk path the API
// route writes into. One list, so the two never drift apart.
export const CASE_COLLECTIONS = [
  { collection: 'cases', dir: 'src/content/cases', label: 'Автоподбор' },
  { collection: 'autoserviceCases', dir: 'src/content/autoservice-cases', label: 'Автосервис' },
  { collection: 'detailingCases', dir: 'src/content/detailing-cases', label: 'Детейлинг' },
] as const;

export function isKnownCaseDir(dir: string): boolean {
  return CASE_COLLECTIONS.some(c => c.dir === dir);
}

// Slugs here are always Keystatic-generated folder names (title -> slug),
// already restricted to this charset — reject anything else rather than
// trusting a path segment from a form field.
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug);
}

// Original upload name, stripped to something safe to use as a filename:
// basename only (no directory components), lowercased extension kept,
// everything else collapsed to [a-z0-9-].
export function sanitizeFilename(originalName: string): string {
  const base = originalName.split(/[/\\]/).pop() || 'photo';
  const dot = base.lastIndexOf('.');
  const hasExt = dot > 0; // dot===0 is a dotfile like ".jpg" — no real name part
  const name = hasExt ? base.slice(0, dot) : '';
  const ext = (dot >= 0 ? base.slice(dot + 1) : '').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'photo';
  return `${safeName}.${ext}`;
}

// Avoids clobbering an existing gallery/foo.jpg: foo.jpg -> foo-2.jpg -> foo-3.jpg...
export function dedupeFilename(filename: string, taken: Set<string>): string {
  if (!taken.has(filename)) return filename;
  const dot = filename.lastIndexOf('.');
  const name = dot > 0 ? filename.slice(0, dot) : filename;
  const ext = dot > 0 ? filename.slice(dot) : '';
  let n = 2;
  while (taken.has(`${name}-${n}${ext}`)) n++;
  return `${name}-${n}${ext}`;
}

// Inserts/appends `gallery/<file>` entries right after the `image:` line,
// matching where Keystatic itself puts the gallery field (schema order in
// keystatic.config.ts). Throws if `image:` isn't found — every case has one
// (validation.isRequired on the schema), so its absence means this isn't a
// case file at all.
export function appendGalleryEntries(raw: string, newPaths: string[]): string {
  const lines = raw.split('\n');
  const imageIdx = lines.findIndex(l => l.startsWith('image:'));
  if (imageIdx === -1) throw new Error('appendGalleryEntries: no `image:` line found');

  const entries = newPaths.map(p => `  - ${p}`);
  let insertAt = imageIdx + 1;
  if (lines[insertAt] === 'gallery: []') {
    // Keystatic writes an empty gallery as inline `gallery: []`, not a bare
    // `gallery:` header — turn it into block form before appending, or the
    // `  - ` entries below end up dangling after the inline `[]`.
    lines[insertAt] = 'gallery:';
    insertAt++;
  } else if (lines[insertAt]?.startsWith('gallery:')) {
    insertAt++;
    while (lines[insertAt]?.startsWith('  - ')) insertAt++;
  } else {
    lines.splice(insertAt, 0, 'gallery:');
    insertAt++;
  }
  lines.splice(insertAt, 0, ...entries);
  return lines.join('\n');
}
