export type PublishPurge = (pattern: string) => Promise<void>;

export const CATALOGUE_HUB_PATTERNS = [
  '-/[a-z][a-z]/cars/',
  '-/[a-z][a-z]/parts/$',
  '-/[a-z][a-z]/parts/[0-9a-oq-z]',
  '-/[a-z][a-z]/parts/p[0-9a-z-]',
  'llms[.]txt',
  'sitemap',
  'catalogue-build[.]json',
];

export const partPagePattern = (slug: string) =>
  `-/[a-z][a-z]/parts/p/${slug.replace(/[^a-z0-9-]/g, '.')}/`;

export const cachePurge =
  (endpoint: string | undefined): PublishPurge =>
  async (pattern) => {
    if (!endpoint) return;
    const response = await fetch(`${endpoint}/${pattern}`, {
      method: 'PURGE',
    });
    if (!response.ok) {
      throw new Error(
        `The page cache refused the purge of ${pattern}: ${response.status} ${response.statusText}`,
      );
    }
  };
