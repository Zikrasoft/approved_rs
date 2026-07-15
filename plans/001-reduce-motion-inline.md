# 001 — Fix inline animation prefers-reduced-motion bypass

- **Status**: DONE
- **Commit**: 837e739
- **Severity**: HIGH
- **Category**: Accessibility
- **Estimated scope**: 3 files (index.astro, contacts.astro, privacy.astro) + global.css

## Problem

Inline `style="animation: fadeUp ..."` attributes bypass the `@media (prefers-reduced-motion: reduce)` CSS guard in `src/styles/global.css`. The guard targets named classes (`.fade-up`, `.fade-up-1`, etc.) but not inline style attributes, so users who have set "Reduce Motion" in their OS still see all page animations.

**src/pages/index.astro:109** (service cards)
```astro
style={`animation: fadeUp 0.75s ${0.08 + i * 0.08}s cubic-bezier(0.16,1,0.3,1) both;`}
```

**src/pages/index.astro:152** (step items)
```astro
style={`animation: fadeUp 0.75s ${0.1 + i * 0.1}s cubic-bezier(0.16,1,0.3,1) both;`}
```

**src/pages/contacts.astro:39**
```astro
style={`animation: fadeUp 0.75s ${0.15 + i * 0.08}s cubic-bezier(0.16,1,0.3,1) both;`}
```

**src/pages/contacts.astro:51**
```astro
style={`animation: fadeUp 0.75s ${0.2 + i * 0.1}s cubic-bezier(0.16,1,0.3,1) both;`}
```

**src/pages/privacy.astro:44**
```astro
style={`animation: fadeUp 0.5s ${0.1 + i * 0.1}s both`}
```

Additionally, the current reduced-motion guard in global.css nukes ALL transitions including focus rings and color feedback:
```css
/* src/styles/global.css:290 — current (too broad) */
* { transition-duration: 0.01ms !important; }
```

## Target

Replace the catch-all `* { transition-duration: 0.01ms }` with a precise override that only suppresses movement, and add a `.anim-inline` utility class that carries inline animation delays (so CSS can override it). Use this class on all elements currently using inline `style="animation: ..."`.

```css
/* target — @media block in global.css */
@media (prefers-reduced-motion: reduce) {
  .fade-up, .fade-up-1, .fade-up-2, .fade-up-3,
  .fade-up-4, .fade-up-5, .fade-up-6,
  .anim-inline {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
  .eyebrow::before { animation: none; }
  /* Suppress position/size/scale transitions only; keep color/opacity */
  *,
  *::before,
  *::after {
    transition-property: color, background-color, border-color, box-shadow, outline-color !important;
    transition-duration: 0.2s !important;
  }
}
```

For each inline-animated element, swap the `style="animation: fadeUp..."` for a `class="anim-inline"` plus a CSS variable for the delay:

```astro
<!-- target pattern — service card in index.astro -->
<a
  class:list={['service-card ... anim-inline']}
  style={`--anim-delay: ${0.08 + i * 0.08}s`}
>
```

```css
/* add to global.css */
.anim-inline {
  animation: fadeUp 0.75s var(--anim-delay, 0s) cubic-bezier(0.16, 1, 0.3, 1) both;
}
```

Privacy page items use 0.5s instead of 0.75s — add a `.anim-inline-fast` variant:
```css
.anim-inline-fast {
  animation: fadeUp 0.5s var(--anim-delay, 0s) cubic-bezier(0.16, 1, 0.3, 1) both;
}
```

## Repo conventions to follow

- CSS tokens and keyframes live in `src/styles/global.css`
- Tailwind `class:list` is the pattern for conditional classes in .astro files
- `style` attribute is used only for dynamic CSS variables (e.g. `--anim-delay`) — not for full animation declarations

Exemplar (existing, correct pattern):
```astro
<!-- src/pages/index.astro hero section — uses .fade-up class correctly -->
<span class="eyebrow fade-up fade-up-1">...</span>
<h1 class="... fade-up fade-up-2">...</h1>
```

## Steps

1. **global.css** — Add `.anim-inline` and `.anim-inline-fast` utilities after the `@keyframes slideRight` block:
   ```css
   .anim-inline      { animation: fadeUp 0.75s var(--anim-delay, 0s) cubic-bezier(0.16, 1, 0.3, 1) both; }
   .anim-inline-fast { animation: fadeUp 0.5s  var(--anim-delay, 0s) cubic-bezier(0.16, 1, 0.3, 1) both; }
   ```

2. **global.css** — Replace the existing `@media (prefers-reduced-motion: reduce)` block with the precise version from the Target section above.

3. **src/pages/index.astro:109** — Remove `style="animation: ..."` from service card, add class + delay var:
   ```astro
   <a
     class:list={['service-card group ... anim-inline', featured ? 'lg:col-span-2 p-9' : 'p-7']}
     style={`--anim-delay: ${0.08 + i * 0.08}s`}
   >
   ```

4. **src/pages/index.astro:152** — Same for step items:
   ```astro
   <div class="anim-inline" style={`--anim-delay: ${0.1 + i * 0.1}s`}>
   ```

5. **src/pages/contacts.astro:39** — Replace inline animation style:
   ```astro
   <div class="flex justify-between items-center py-4 border-b border-default anim-inline" style={`--anim-delay: ${0.15 + i * 0.08}s`}>
   ```

6. **src/pages/contacts.astro:51** — Replace inline animation style:
   ```astro
   <div class="flex gap-4 anim-inline" style={`--anim-delay: ${0.2 + i * 0.1}s`}>
   ```

7. **src/pages/privacy.astro:44** — Replace inline animation style (use `anim-inline-fast`):
   ```astro
   <div class="pb-10 border-b border-default anim-inline-fast" style={`--anim-delay: ${0.1 + i * 0.1}s`}>
   ```

## Boundaries

- Do NOT touch animation values (duration, easing) in any file — only move them from inline style to CSS class.
- Do NOT modify any layout or content.
- Do NOT add any new dependencies.
- privacy.astro was missing the cubic-bezier — this plan ADDS it via `.anim-inline-fast`.
- If drift: the inline `style="animation:"` may have already been removed. Check and skip that step.

## Verification

- **Mechanical**: `pnpm build` — expected: no errors.
- **Feel check**:
  1. Open DevTools → Rendering panel → Enable "Emulate CSS media feature prefers-reduced-motion: reduce".
  2. Reload. All page content should be immediately visible (no fade-up entrance). Form, stat blocks, service cards — all should appear without movement.
  3. Hover states (button glow, card lift, nav underline) should still animate smoothly — they are NOT suppressed.
  4. Disable the emulation. Reload. Staggered fade-up should play normally.
  5. In DevTools Animations panel, set playback to 10%. Confirm service cards stagger with correct delays.
- **Done when**: with `prefers-reduced-motion: reduce` emulated, zero elements show transform or opacity-to-0 animation on load.
