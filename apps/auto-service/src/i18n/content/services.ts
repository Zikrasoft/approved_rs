import servicesYaml from '@/content/i18n/services.yaml?raw';
import { loadI18nSection } from '@/i18n/loadI18nSection';
import { servicesContentSchema } from './servicesContentSchema';

export type { ServicesContent } from './servicesContentSchema';

export const getServicesContent = loadI18nSection(
  servicesContentSchema,
  servicesYaml,
);
