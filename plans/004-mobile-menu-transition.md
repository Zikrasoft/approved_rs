# 004 — Add mobile menu open/close transition

- **Status**: TODO
- **Commit**: 837e739
- **Severity**: LOW (missed opportunity)
- **Category**: Missed Opportunities / Interruptibility
- **Estimated scope**: Header.astro (1 file — CSS + JS)

## Problem

The mobile menu currently appears and disappears instantly via a `hidden` class toggle in JavaScript. This abrupt show/hide feels low-quality relative to the rest of the site's motion vocabulary.

**src/components/Header.astro — current JS (burger click handler)**
```js
menu.classList.toggle('hidden');
```

**src/components/Header.astro — current CSS**
```css
/* No transition on #mobile-menu */
```

## Target

A 220ms fade + clip-path reveal from the top edge. Clip-path is GPU-composited, so no layout thrash.

```css
/* Header.astro <style> block — add: */
#mobile-menu {
  overflow: hidden;
  clip-path: inset(0 0 100% 0);
  opacity: 0;
  transition:
    clip-path 220ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 180ms ease;
  pointer-events: none;
}
#mobile-menu.menu-open {
  clip-path: inset(0 0 0% 0);
  opacity: 1;
  pointer-events: auto;
}
```

```js
// Header.astro <script> — replace menu.classList.toggle('hidden') with:
burger.addEventListener('click', function () {
  var expanded = burger.getAttribute('aria-expanded') === 'true';
  burger.setAttribute('aria-expanded', String(!expanded));
  menu.classList.toggle('menu-open');
  open  && open.classList.toggle('hidden');
  close && close.classList.toggle('hidden');
});

menu.querySelectorAll('a').forEach(function (a) {
  a.addEventListener('click', function () {
    menu.classList.remove('menu-open');
    open  && open.classList.remove('hidden');
    close && close.classList.add('hidden');
    burger.setAttribute('aria-expanded', 'false');
  });
});
```

Remove `hidden` from the initial HTML so CSS controls visibility:
```astro
<!-- current -->
<div id="mobile-menu" class="hidden md:hidden border-t bg-header-mobile border-default">
<!-- target -->
<div id="mobile-menu" class="md:hidden border-t bg-header-mobile border-default">
```

Reduced-motion variant (in the existing `@media (prefers-reduced-motion: reduce)` block in global.css):
```css
#mobile-menu {
  transition: opacity 0.15s ease;
  clip-path: none !important;
}
```

## Repo conventions to follow

- Transitions use the site's easing: `cubic-bezier(0.16, 1, 0.3, 1)` (or `var(--ease-spring)` if Plan 002 is executed first).
- JS in Header.astro uses vanilla JS IIFE pattern — no framework. Keep it that way.
- `pointer-events: none` / `auto` is the pattern for showing/hiding interactive overlays without `display:none`.

## Steps

1. **Header.astro HTML** — Remove `hidden` from `#mobile-menu`'s initial classes.

2. **Header.astro `<style>`** — Add the `#mobile-menu` and `#mobile-menu.menu-open` rules from the Target section.

3. **Header.astro `<script>`** — In the burger click handler: replace `menu.classList.toggle('hidden')` with `menu.classList.toggle('menu-open')`.

4. **Header.astro `<script>`** — In the link click handlers inside the menu: replace `menu.classList.add('hidden')` with `menu.classList.remove('menu-open')`.

5. **global.css** — In the `@media (prefers-reduced-motion: reduce)` block, add the `#mobile-menu` reduced-motion override from the Target section.

## Boundaries

- Do NOT change desktop header layout or the sticky `z-50` positioning.
- Do NOT touch burger icon or theme toggle.
- Do NOT add any animation libraries.
- `md:hidden` on the menu must remain — it still hides the mobile menu on desktop.

## Verification

- **Mechanical**: `pnpm build` — no errors. Resize browser to mobile width.
- **Feel check**:
  1. At mobile width (<768px), tap the burger icon. Menu should slide/reveal from the top edge in ~220ms.
  2. Tap a nav link. Menu should fade out.
  3. Tap the burger again quickly (interrupt). Menu state should retarget cleanly.
  4. On desktop, verify the mobile menu is invisible (CSS `md:hidden` still applies via Tailwind).
  5. Emulate `prefers-reduced-motion: reduce` in DevTools → menu should still appear/disappear but with opacity fade only, no clip-path movement.
- **Done when**: mobile menu open/close has a visible transition on all mobile widths.
