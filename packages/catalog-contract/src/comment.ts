export type CommentParts = {
  head: string[];
  lines: string[];
  tail?: string[];
  note?: string;
  limit: number;
  more: (count: number) => string;
};

const filled = (lines: string[]) =>
  lines.map((line) => line.trim()).filter(Boolean);

const ELLIPSIS = '…';

export function fitComment({
  head,
  lines,
  tail = [],
  note = '',
  limit,
  more,
}: CommentParts): string {
  const compose = (kept: number, ...ending: string[]) =>
    [
      ...filled(head),
      ...lines.slice(0, kept),
      ...(kept < lines.length ? [more(lines.length - kept)] : []),
      ...filled(tail),
      ...filled(ending),
    ].join('\n');

  let kept = lines.length;
  while (kept > 0 && compose(kept).length > limit) {
    kept -= 1;
  }
  const text = note.trim();
  const room = limit - compose(kept).length - 1;
  const fitted =
    text.length <= room
      ? text
      : room > ELLIPSIS.length
        ? `${text.slice(0, room - ELLIPSIS.length)}${ELLIPSIS}`
        : '';
  return compose(kept, fitted).slice(0, limit);
}
