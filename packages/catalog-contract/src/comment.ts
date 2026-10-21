export type CommentParts = {
  head: string[];
  lines: string[];
  tail: string[];
  limit: number;
  more: (count: number) => string;
};

const filled = (lines: string[]) =>
  lines.map((line) => line.trim()).filter(Boolean);

export function fitComment({
  head,
  lines,
  tail,
  limit,
  more,
}: CommentParts): string {
  const compose = (kept: number) =>
    [
      ...filled(head),
      ...lines.slice(0, kept),
      ...(kept < lines.length ? [more(lines.length - kept)] : []),
      ...filled(tail),
    ].join('\n');

  let kept = lines.length;
  while (kept > 0 && compose(kept).length > limit) {
    kept -= 1;
  }
  return compose(kept).slice(0, limit);
}
