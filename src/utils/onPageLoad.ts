// Runs fn now and again after every ClientRouter navigation — astro:page-load
// only auto-fires once per script, but freshly swapped-in DOM on later
// pages still needs its listeners wired up.
export function onPageLoad(fn: () => void) {
  fn();
  document.addEventListener('astro:page-load', fn);
}
