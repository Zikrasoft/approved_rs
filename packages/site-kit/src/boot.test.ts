import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: string[] = [];
const record = (name: string) => vi.fn(() => void calls.push(name));

vi.mock('./adTouch.ts', () => ({ rememberAdTouch: record('adTouch') }));
vi.mock('./analytics.ts', () => ({ defineAnalytics: record('analytics') }));
vi.mock('./contactClick.ts', () => ({
  defineContactClickTracking: record('contactClick'),
}));
vi.mock('./contactPreference.ts', () => ({
  applyContactPreference: record('contactPreference'),
}));
vi.mock('./languageSuggestion.ts', () => ({
  defineLanguageSuggestion: record('languageSuggestion'),
}));
vi.mock('./funnel.ts', () => ({ defineFunnelTracking: record('funnel') }));

const boot = async () => (await import('./boot.ts')).bootSiteKit;

beforeEach(() => {
  calls.length = 0;
  vi.resetModules();
});

describe('bootSiteKit', () => {
  it('arms every part once, in order', async () => {
    const { defineAnalytics } = await import('./analytics.ts');
    (await boot())({
      ymCounterId: 42,
      gaMeasurementId: 'G-42',
      metaPixelId: '7',
      googleAdsId: 'AW-1',
      googleConversionLabels: { form_submit: 'Lead1' },
      analytics: true,
    });
    expect(calls).toEqual([
      'analytics',
      'adTouch',
      'contactClick',
      'contactPreference',
      'languageSuggestion',
      'funnel',
    ]);
    expect(defineAnalytics).toHaveBeenCalledWith({
      ymCounterId: 42,
      gaMeasurementId: 'G-42',
      metaPixelId: '7',
      googleAdsId: 'AW-1',
      googleConversionLabels: { form_submit: 'Lead1' },
    });
  });

  it('makes a second boot a no-op', async () => {
    const bootSiteKit = await boot();
    bootSiteKit({ gaMeasurementId: 'G-42', analytics: true });
    bootSiteKit({ gaMeasurementId: 'G-42', analytics: true });
    expect(calls).toHaveLength(6);
  });

  it('skips the counter when analytics is off', async () => {
    (await boot())({
      gaMeasurementId: 'G-42',
      metaPixelId: '7',
      analytics: false,
    });
    expect(calls).not.toContain('analytics');
    expect(calls).toHaveLength(5);
  });
});
