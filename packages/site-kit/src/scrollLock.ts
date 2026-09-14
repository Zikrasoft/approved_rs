let held = 0;
let restoreOverflow = '';
let restoreOverscroll = '';

export function lockScroll(): void {
  if (held++ > 0) return;
  const root = document.documentElement;
  restoreOverflow = root.style.overflow;
  restoreOverscroll = root.style.overscrollBehavior;
  root.style.overflow = 'hidden';
  root.style.overscrollBehavior = 'none';
}

export function unlockScroll(): void {
  if (held === 0 || --held > 0) return;
  const root = document.documentElement;
  root.style.overflow = restoreOverflow;
  root.style.overscrollBehavior = restoreOverscroll;
}
