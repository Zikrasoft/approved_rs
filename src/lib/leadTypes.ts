import type { Locale } from '@/i18n/config';

export interface LeadData {
  id: number;
  name: string;
  contact: string;
  service: string;
  contactChannel?: string | null;
  comment?: string | null;
  country?: string | null;
  source_url?: string | null;
  locale: Locale;
}
