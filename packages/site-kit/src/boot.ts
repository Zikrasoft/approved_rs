import { rememberAdTouch } from './adTouch.ts';
import { defineAnalytics } from './analytics.ts';
import { defineContactClickTracking } from './contactClick.ts';
import { applyContactPreference } from './contactPreference.ts';
import { defineFunnelTracking } from './funnel.ts';
import { defineLanguageSuggestion } from './languageSuggestion.ts';

export interface SiteKitConfig {
  ymCounterId?: number;
  metaPixelId?: string;
  googleAdsId?: string;
  googleConversionLabels?: Partial<Record<string, string>>;
  analytics: boolean;
}

let booted = false;

export function bootSiteKit({
  ymCounterId,
  metaPixelId,
  googleAdsId,
  googleConversionLabels,
  analytics,
}: SiteKitConfig): void {
  if (booted) return;
  booted = true;
  if (analytics)
    defineAnalytics({
      ymCounterId,
      metaPixelId,
      googleAdsId,
      googleConversionLabels,
    });
  rememberAdTouch();
  defineContactClickTracking();
  applyContactPreference();
  defineLanguageSuggestion();
  defineFunnelTracking();
}
