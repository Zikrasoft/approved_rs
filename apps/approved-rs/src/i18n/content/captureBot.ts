import captureBotYaml from '@/content/i18n/captureBot.yaml?raw';
import { captureCopySchema } from '@podbor/lead-capture/copy';
import { loadI18nSection } from '@/i18n/loadI18nSection';

export const getCaptureBotCopy = loadI18nSection(
  captureCopySchema,
  captureBotYaml,
);
