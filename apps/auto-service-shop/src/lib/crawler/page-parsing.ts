export const words = (text: string) =>
  text
    .replace(/\u200b/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();

export const parsedJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export const imageUrls = (
  sources: (string | undefined)[],
  { keepQuery = false } = {},
): string[] => [
  ...new Set(
    sources.flatMap((source) => {
      if (!source) return [];
      const url = new URL(source);
      if (!keepQuery) url.search = '';
      return [url.href];
    }),
  ),
];
