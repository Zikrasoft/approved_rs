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
  integrations: [react(), keystatic(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
