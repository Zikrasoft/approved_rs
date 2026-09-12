export { assertSafeTranslation } from './assertSafeTranslation.ts';
export { getOrCreateTranslationsMap } from './getOrCreateTranslationsMap.ts';
export { hasRealTranslation } from './hasRealTranslation.ts';
export { sha256Hex } from './sha256Hex.ts';
export { decideAction } from './translateDecision.ts';
export type { Action } from './translateDecision.ts';
export { callOpenAiJson, DEFAULT_TRANSLATE_MODEL } from './openaiChat.ts';

export { createSectionTranslator, hashSource } from './sections.ts';
export type {
  Section,
  SectionData,
  SectionOutcome,
  SectionTranslatorOptions,
} from './sections.ts';

export {
  createCaseTranslator,
  splitFrontmatter,
  hashSource as hashCaseSource,
} from './cases.ts';
export type {
  CaseTranslation,
  CaseOutcome,
  CaseTranslatorOptions,
} from './cases.ts';
