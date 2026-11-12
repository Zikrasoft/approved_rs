const EM_DASH = '—';

export const NO_EM_DASH_RULE =
  `Never use an em dash (${EM_DASH}) anywhere in the translation, it reads as an AI-generated-text ` +
  'tell. Use a comma, period, colon, or a plain hyphen instead, whichever reads naturally.';

export const NO_CYRILLIC_RULE =
  'The translation must contain no Cyrillic letters at all. Transliterate Cyrillic unit ' +
  'abbreviations and personal names into the Latin spelling of the target language: мм becomes mm, ' +
  'кг becomes kg, and Михаил becomes Mihailo in Serbian or Mikhail in English.';

export const STRAIGHT_QUOTES_RULE =
  'Use straight ASCII apostrophes and quotation marks (\' and "), never typographic ones such as ’ or “.';

export const SERBIAN_CAR_TRADE_GUIDANCE =
  'Write Serbian the way people in Belgrade actually talk about cars: ekavian, Latin script, the word a ' +
  'Serbian mechanic uses rather than a textbook one. Servicing is servis (mali servis for oil and filters, ' +
  'veliki servis when the timing belt is changed), an oil change is zamena ulja, the suspension is trap ' +
  '(popravka trapa, geometrija trapa for wheel alignment), brake pads and discs are kočione pločice and ' +
  'diskovi, the timing belt is zupčasti kaiš, then kvačilo, menjač, automatski menjač, dvomaseni zamajac, ' +
  'homokinetički zglob, letva volana, silen blokovi, amortizeri, anlaser, alternator, akumulator, ' +
  'svećice, dizne for fuel injectors, turbina, DPF filter, EGR ventil, punjenje klime, očitavanje grešaka, ' +
  'and limarija i farbanje (limarsko-farbarski radovi) for body repair and paint. The VIN is broj šasije. ' +
  'The V of a V engine (развал двигателя, развал блока) is prostor između redova cilindara, never the ' +
  'bottom of the engine. Address the reader politely with a capital V: Vi, Vam, Vaš. ' +
  '"Подходит, в том числе, для X" is "Odgovara, između ostalog, vozilima X". ' +
  'Use ekavian forms (vreme, deo, delovi, cena, menjač), never ijekavian ones (vrijeme, dio, cijena, ' +
  'mjenjač), and never Croatian words (kotač, zrak, tisuća, točka): točak, vazduh, hiljada, tačka. ' +
  'Never name a specific workshop machine the Russian does not name; say what the work is instead ' +
  '(na dijagnostici, na proveri). In repair write-ups, sound like the mechanic who did the job telling ' +
  'the owner about it: short concrete sentences in the first person plural (skinuli smo, zamenili smo, ' +
  'proverili smo), no marketing filler.';
