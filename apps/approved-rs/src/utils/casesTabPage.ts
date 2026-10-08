import { SITE_NAME } from '@/utils/constants';
import { getPages } from '@/i18n/content/pages';
import { getCasesTabCounts } from '@/utils/casesQueries';
import type { CaseCardProps } from '@/components/CaseCard.astro';
import type { Locale } from '@/i18n/config';

type CasesTabPageContentKey =
  | 'casesVehicleSourcing'
  | 'casesVehicleBuyback'
  | 'casesVehicleInspection'
  | 'casesVehicleImport';

export async function buildCasesTabPageData(
  locale: Locale,
  contentKey: CasesTabPageContentKey,
  fetchItems: () => Promise<CaseCardProps[]>,
) {
  const p = getPages(locale)[contentKey];
  const meta = {
    title: `${p.metaTitle} | ${SITE_NAME}`,
    description: p.metaDescription,
  };
  const [items, counts] = await Promise.all([
    fetchItems(),
    getCasesTabCounts(),
  ]);
  return { meta, items, counts };
}
