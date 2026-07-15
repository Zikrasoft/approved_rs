# 003 — Reduce CaseCard image hover duration

- **Status**: TODO
- **Commit**: 837e739
- **Severity**: MEDIUM
- **Category**: Purpose & Frequency / Duration
- **Estimated scope**: 1 file (CaseCard.astro), 1 class change

## Problem

The case card image zoom on hover uses `duration-700` (700ms). This is a hover effect triggered tens of times per day — AUDIT.md budget for hover effects is 200–300ms. At 700ms the zoom feels sluggish and lags behind the cursor intent, making the site feel slow.

**src/components/CaseCard.astro:21 — current**
```astro
class="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
```

## Target

Reduce to 400ms — long enough to be a smooth image zoom, short enough to feel responsive:

```astro
class="w-full h-full object-cover transition-transform duration-400 ease-out group-hover:scale-105"
```

`duration-400` is a standard Tailwind duration value (`400ms`). No new tokens needed.

## Repo conventions to follow

- Hover effects on cards use Tailwind utility classes directly on the element.
- The card lift transition is set in the component's `<style>` block at 0.3s — the image zoom at 0.4s is a deliberate choice to make the zoom feel slightly softer than the card lift.

Exemplar:
```css
/* CaseCard.astro <style> block */
.case-card { transition: border-color 0.3s, box-shadow 0.3s, transform 0.3s; }
```

## Steps

1. **src/components/CaseCard.astro:21** — Change `duration-700` to `duration-400`:
   ```astro
   class="w-full h-full object-cover transition-transform duration-400 ease-out group-hover:scale-105"
   ```

## Boundaries

- Do NOT touch the card lift transition (`transform 0.3s` in the `<style>` block).
- Do NOT touch `scale-105` value.
- Do NOT change the empty card placeholder (no image path).

## Verification

- **Mechanical**: `pnpm build` — no errors.
- **Feel check**:
  1. Navigate to `/cases/` (the cases index page).
  2. Hover over a case card that has a real image.
  3. The image should zoom in noticeably faster than before — responsive to cursor, not lagging.
  4. In DevTools Animations panel at 25% speed: confirm the zoom animation completes in ~400ms.
  5. Hover on and off rapidly — confirm the zoom reverses promptly without a long tail.
- **Done when**: image zoom on hover feels snappy, not slow.
