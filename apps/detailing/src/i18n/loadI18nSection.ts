import { createSectionLoader } from '@podbor/i18n';
import type { Locale } from './config';

export const loadI18nSection = createSectionLoader<Locale>();
