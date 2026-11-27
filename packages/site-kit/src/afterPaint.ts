export function afterNextPaint(run: () => void): void {
  requestAnimationFrame(() => setTimeout(run, 0));
}
