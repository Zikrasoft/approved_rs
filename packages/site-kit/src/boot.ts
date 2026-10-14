import { rememberAdTouch } from './adTouch.ts';
import { defineAnalytics } from './analytics.ts';
import type { Goal } from './goals.ts';
import { defineContactClickTracking } from './contactClick.ts';
import { applyContactPreference } from './contactPreference.ts';
import { defineFunnelTracking } from './funnel.ts';
import { defineLanguageSuggestion } from './languageSuggestion.ts';

export interface SiteKitConfig {
  metaPixelId?: string;
  googleAdsId?: string;
  gaMeasurementId?: string;
  googleConversionLabels?: Partial<Record<Goal, string>>;
  analytics: boolean;
}

let booted = false;

export function bootSiteKit({
  metaPixelId,
  googleAdsId,
  gaMeasurementId,
  googleConversionLabels,
  analytics,
}: SiteKitConfig): void {
  if (booted) return;
  booted = true;
  if (analytics)
    defineAnalytics({
      metaPixelId,
      googleAdsId,
      gaMeasurementId,
      googleConversionLabels,
    });
  rememberAdTouch();
  defineContactClickTracking();
  applyContactPreference();
  defineLanguageSuggestion();
  defineFunnelTracking();
}
