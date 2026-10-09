import { defineAnalytics } from './analytics.ts';
import { defineContactClickTracking } from './contactClick.ts';
import { applyContactPreference } from './contactPreference.ts';
import { defineFunnelTracking } from './funnel.ts';
import { defineLanguageSuggestion } from './languageSuggestion.ts';

export interface SiteKitConfig {
  ymCounterId?: number;
  analytics: boolean;
}

let booted = false;

export function bootSiteKit({ ymCounterId, analytics }: SiteKitConfig): void {
  if (booted) return;
  booted = true;
  if (analytics) defineAnalytics({ ymCounterId });
  defineContactClickTracking();
  applyContactPreference();
  defineLanguageSuggestion();
  defineFunnelTracking();
}
