/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    suggestedCountry?: import('./utils/geo').Country;
  }
}
