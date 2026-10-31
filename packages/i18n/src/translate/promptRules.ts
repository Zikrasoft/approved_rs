const EM_DASH = '—';

export const NO_EM_DASH_RULE =
  `Never use an em dash (${EM_DASH}) anywhere in the translation, it reads as an AI-generated-text ` +
  'tell. Use a comma, period, colon, or a plain hyphen instead, whichever reads naturally.';

export const NO_CYRILLIC_RULE =
  'The translation must contain no Cyrillic letters at all. Transliterate Cyrillic unit ' +
  'abbreviations and personal names into the Latin spelling of the target language: мм becomes mm, ' +
  'кг becomes kg, and Михаил becomes Mihailo in Serbian or Mikhail in English.';
