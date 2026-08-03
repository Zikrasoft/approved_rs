// astro.config.mjs
import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";
import react from "@astrojs/react";
import keystatic from "@keystatic/astro";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://approved.rs",
  output: "server",
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
