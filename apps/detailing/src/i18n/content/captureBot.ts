import captureBotYaml from '@/content/i18n/captureBot.yaml?raw';
import type { Locale } from '@/i18n/config';
import { loadI18nSection } from '@/i18n/loadI18nSection';
import {
  captureBotContentSchema,
  type CaptureBotContent,
} from './captureBotContentSchema';

const getCaptureBotContent = loadI18nSection(
  captureBotContentSchema,
  captureBotYaml,
);

export function getCaptureBotCopy(locale: Locale): CaptureBotContent {
  return getCaptureBotContent(locale);
}
