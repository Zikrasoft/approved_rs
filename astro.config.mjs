// astro.config.mjs
import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";
import react from "@astrojs/react";
import keystatic from "@keystatic/astro";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://approved.rs",
  // Static by default — 14 of 15 pages are fully static; the two API routes
  // and the homepage (needs Astro.locals.suggestedCountry from middleware
  // for the geo banner) opt into SSR individually via `prerender = false`
  // instead of every static page opting in via `prerender = true`.
  output: "static",
  adapter: vercel(),
  i18n: {
    locales: ["ru", "en", "sr", "es", "de"],
    defaultLocale: "ru",
    routing: "manual",
  },
  integrations: [
    react(),
    keystatic(),
    sitemap({
      i18n: {
        defaultLocale: "ru",
        locales: { ru: "ru-RU", en: "en-US", sr: "sr-RS", es: "es-ES", de: "de-DE" },
      },
      // Internal dev-only tool, not a real page (see pages/admin/case-photos.astro).
      filter: (page) => !page.includes("/admin/case-photos"),
    }),
  ],
  // Legacy-slug + locale-prefix redirects live in src/middleware.ts for
  // requests that reach it — but on Vercel's static output, middleware only
  // runs for paths matching a real Astro route (see src/pages/index.astro's
  // comment for the same caveat re: '/'). Deleted old-slug pages have no
  // route left to match, so those 301s are duplicated in vercel.json, which
  // Vercel evaluates at the edge before routing — the only place they still
  // fire once the page is gone. middleware.ts's copy stays for local dev
  // (vercel.json redirects aren't read by `astro dev`) and as the source of
  // truth `vercel.json` was hand-derived from.
  vite: {
    plugins: [tailwindcss()],
  },
});
