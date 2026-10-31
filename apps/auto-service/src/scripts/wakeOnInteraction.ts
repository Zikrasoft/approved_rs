export function wakeOnInteraction(
  selector: string,
  load: () => Promise<unknown>,
  root: ParentNode = document,
): void {
  const wake = () => void load();
  for (const box of root.querySelectorAll(selector)) {
    box.addEventListener('focusin', wake, { once: true });
    box.addEventListener('pointerdown', wake, { once: true });
  }
}
