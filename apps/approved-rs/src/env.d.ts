/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    suggestedCountry?: import('./utils/geo').Country;
  }
}

// Set by BaseLayout's analytics bootstrap script (src/layouts/BaseLayout.astro) —
// ym is only defined once cookie consent is granted and the Yandex snippet runs.
interface Window {
  dataLayer: unknown[];
  gtag: (...args: unknown[]) => void;
  ym?: (...args: unknown[]) => void;
  ymReachGoal: (goal: string, params?: Record<string, unknown>) => void;
  loadAnalytics: () => void;
  __gaLoaded?: boolean;
}
