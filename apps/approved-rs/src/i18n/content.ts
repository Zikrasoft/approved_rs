import { createContent } from '@podbor/i18n';
import { loadI18nSection } from './loadI18nSection';
import { SECTIONS } from './sections';

export const content = createContent(
  loadI18nSection,
  SECTIONS,
  import.meta.glob<string>('/src/content/i18n/*.yaml', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
);
