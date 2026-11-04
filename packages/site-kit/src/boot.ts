import { rememberAdTouch } from './adTouch.ts';
import { defineAnalytics } from './analytics.ts';
import type { Goal } from './goals.ts';
import { defineContactClickTracking } from './contactClick.ts';
import {
  applyContactPreference,
  type ContactRanking,
} from './contactPreference.ts';
import { defineFunnelTracking } from './funnel.ts';
import { defineLanguageSuggestion } from './languageSuggestion.ts';

export interface SiteKitConfig {
  ymCounterId?: number;
  metaPixelId?: string;
  googleAdsId?: string;
  gaMeasurementId?: string;
  googleConversionLabels?: Partial<Record<Goal, string>>;
  privateParams?: readonly string[];
  analytics: boolean;
  contactRanking?: ContactRanking;
}

let booted = false;

export function bootSiteKit({
  ymCounterId,
  metaPixelId,
  googleAdsId,
  gaMeasurementId,
  googleConversionLabels,
  privateParams,
  analytics,
  contactRanking,
}: SiteKitConfig): void {
  if (booted) return;
  booted = true;
  if (analytics)
    defineAnalytics({
      ymCounterId,
      metaPixelId,
      googleAdsId,
      gaMeasurementId,
      googleConversionLabels,
      privateParams,
    });
  rememberAdTouch();
  defineContactClickTracking();
  applyContactPreference(contactRanking);
  defineLanguageSuggestion();
  defineFunnelTracking();
}
