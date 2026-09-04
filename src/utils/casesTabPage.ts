import { SITE_URL, SITE_NAME } from '@/utils/constants';
import { getPagesContent } from '@/i18n/content/pages';
import { getCasesTabCounts } from '@/utils/casesQueries';
import type { CaseCardProps } from '@/components/CaseCard.astro';
import type { Locale } from '@/i18n/config';

type CasesTabPageContentKey =
  | 'casesVehicleSourcing'
  | 'casesVehicleBuyback'
  | 'casesVehicleInspection'
  | 'casesVehicleImport'
  | 'casesAutoService'
  | 'casesDetailing';

// Shared by every /cases/<tab>.astro page — each one only differs in which
// PagesContent block/canonical path/item-fetching it uses; the meta-building
// and tab-counts wiring was identical across all 6 before this.
export async function buildCasesTabPageData(
  locale: Locale,
  contentKey: CasesTabPageContentKey,
  canonicalPath: string,
  fetchItems: () => Promise<CaseCardProps[]>,
) {
  const p = getPagesContent(locale)[contentKey];
  const meta = {
    title: `${p.metaTitle} | ${SITE_NAME}`,
    description: p.metaDescription,
    canonical: `${SITE_URL}${canonicalPath}`,
  };
  const [items, counts] = await Promise.all([
    fetchItems(),
    getCasesTabCounts(),
  ]);
  return { meta, items, counts };
}
