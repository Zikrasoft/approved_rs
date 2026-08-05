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
    locales: ["ru", "en", "sr"],
    defaultLocale: "ru",
    routing: "manual",
  },
  integrations: [
    react(),
    keystatic(),
    sitemap({
      i18n: {
        defaultLocale: "ru",
        locales: { ru: "ru-RU", en: "en-US", sr: "sr-RS" },
      },
    }),
  ],
  // Legacy-slug + locale-prefix redirects now live in src/middleware.ts
  // (Task 6) — a single redirect handles both concerns in one hop instead
  // of this static config redirecting to an unprefixed path that the
  // middleware would then have to redirect again.
  vite: {
    plugins: [tailwindcss()],
  },
});
