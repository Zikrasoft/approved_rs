import type { Locale } from './config';
import { content } from './content';
import type { DictionaryContent } from './dictionaryContentSchema';
import {
  getGalleryTemplates,
  type GalleryTemplates,
} from './dictionaries/templates';

export type Dictionary = DictionaryContent & {
  common: DictionaryContent['common'] & {
    gallery: DictionaryContent['common']['gallery'] & GalleryTemplates;
  };
};

export function getI18n(locale: Locale): Dictionary {
  const dictionary = content(locale).dictionary;

  return {
    ...dictionary,
    common: {
      ...dictionary.common,
      gallery: {
        ...dictionary.common.gallery,
        ...getGalleryTemplates(locale),
      },
    },
  };
}
