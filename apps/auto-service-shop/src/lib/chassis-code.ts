export const canonicalChassisCode = (code: string): string =>
  [
    ...new Set(
      code
        .split(/[/,]/u)
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ]
    .sort()
    .join('/') || code.trim();
