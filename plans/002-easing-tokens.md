# 002 — Extract easing token + fix cohesion across codebase

- **Status**: TODO
- **Commit**: 837e739
- **Severity**: MEDIUM
- **Category**: Cohesion & Tokens
- **Estimated scope**: global.css + Header.astro (2 files)

## Problem

`cubic-bezier(0.16, 1, 0.3, 1)` is hand-typed in 7 places across the codebase with no shared token. A single mistype creates a perceptible easing inconsistency. Additionally, if Plan 001 is executed first, it moves 5 of these occurrences into `.anim-inline` / `.anim-inline-fast` classes in global.css, concentrating them — making this plan easier to execute after 001.

Locations:
- `src/styles/global.css:144` — `.fade-up`
- `src/styles/global.css:172` — `.eyebrow::before` slideRight
- `src/components/Header.astro:94` — nav underline transition

(Post-plan-001: also `global.css` `.anim-inline` and `.anim-inline-fast` if executed)

## Target

One CSS custom property, defined once in `src/styles/global.css` in the `:root` / `@theme` block:

```css
/* add to @theme block in global.css */
--ease-spring: cubic-bezier(0.16, 1, 0.3, 1);
```

All occurrences replaced:
```css
/* global.css — .fade-up */
.anim-inline      { animation: fadeUp 0.75s var(--anim-delay, 0s) var(--ease-spring) both; }
.anim-inline-fast { animation: fadeUp 0.5s  var(--anim-delay, 0s) var(--ease-spring) both; }
.fade-up { animation: fadeUp 0.75s var(--ease-spring) both; }
.eyebrow::before { animation: slideRight 0.5s 0.1s var(--ease-spring) both; }
```

```css
/* Header.astro */
.header-nav a::after { transition: transform 0.25s var(--ease-spring); }
```

Also fix nav underline `transform-origin` (finding #5 from audit — same file):
```css
/* Header.astro:93 — current */
transform-origin: center;
/* target */
transform-origin: left;
```

## Repo conventions to follow

- CSS variables for colors/fonts live in the `@theme { }` block in `src/styles/global.css`.
- CSS variables for non-Tailwind values (grid-line, deco-stroke, grain-opacity) live in `:root { }` in `src/styles/global.css`.
- Put `--ease-spring` in `:root` (it's not a Tailwind token, no need for `@theme`).

Exemplar (existing token usage):
```css
/* src/styles/global.css — :root */
--color-grid-line: rgba(59, 79, 110, 0.06);
```

## Steps

1. **global.css** — Add to the `:root { }` block (after `--grain-opacity`):
   ```css
   --ease-spring: cubic-bezier(0.16, 1, 0.3, 1);
   ```

2. **global.css** — Update `.fade-up`:
   ```css
   .fade-up { animation: fadeUp 0.75s var(--ease-spring) both; }
   ```

3. **global.css** — Update `.eyebrow::before`:
   ```css
   animation: slideRight 0.5s 0.1s var(--ease-spring) both;
   ```

4. **global.css** — If Plan 001 was executed: update `.anim-inline` and `.anim-inline-fast` to use `var(--ease-spring)` instead of the literal cubic-bezier.

5. **Header.astro** — Update nav underline transition:
   ```css
   .header-nav a::after {
     ...
     transition: transform 0.25s var(--ease-spring);
   }
   ```

6. **Header.astro** — Fix `transform-origin`:
   ```css
   transform-origin: left; /* was: center */
   ```

## Boundaries

- Do NOT change any timing values (durations, delays).
- Do NOT touch anything in contacts.astro, privacy.astro, or index.astro (covered by Plan 001).
- Do NOT modify any layout or content.

## Verification

- **Mechanical**: `pnpm build` — no errors.
- **Feel check**:
  1. In DevTools Animations panel at 10% speed: nav underline on hover should slide in from the left edge of the link, not from the center.
  2. All page entrance animations should feel identical to before (same easing, just via token).
  3. Search the built CSS for `0.16, 1, 0.3, 1` — should appear 0 times (all replaced by the token value which CSS will inline at build time, or remain as `var(--ease-spring)` depending on Tailwind build pipeline).
- **Done when**: `grep -r "0.16, 1, 0.3, 1" src/` returns 0 results.
