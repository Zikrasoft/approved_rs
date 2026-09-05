import { collection, fields } from '@keystatic/core';
import {
  caseImage,
  translationsField,
  translatedFromField,
} from './sharedFields';

export const casesCollection = collection({
  label: 'Кейсы автоподбора',
  slugField: 'title',
  path: 'src/content/cases/*/',
  // "Preview" button in the entry editor — points at the multi-photo
  // upload prototype (src/pages/admin/case-photos.astro), preselected to
  // this exact case, since Keystatic's own gallery field only accepts
  // one photo at a time (see caseImage() above).
  previewUrl: '/admin/case-photos?dir=src/content/cases&slug={slug}',
  format: { contentField: 'content' },
  // Plain stacked form, full width for every field: the ru `content`
  // body is still a real rich-text field and gets squeezed into the
  // narrow metadata sidebar under Keystatic's default 'content' layout.
  // Fields stay top-level (content.config.ts's schema and every reader
  // of c.data.* expects that shape).
  schema: {
    title: fields.slug({
      name: { label: 'Заголовок', validation: { isRequired: true } },
    }),
    translations: translationsField(),
    content: fields.markdoc({ label: 'Текст (RU)', extension: 'md' }),
    car: fields.text({
      label: 'Автомобиль',
      validation: { isRequired: true },
    }),
    year: fields.integer({
      label: 'Год',
      validation: { isRequired: true },
    }),
    price: fields.object(
      {
        value: fields.text({
          label: 'Цена',
          validation: { isRequired: true },
        }),
        currency: fields.select({
          label: 'Валюта',
          options: [
            { label: '€', value: '€' },
            { label: '$', value: '$' },
            { label: 'дин.', value: 'дин.' },
          ],
          defaultValue: '€',
        }),
      },
      { layout: [8, 4] },
    ),
    country: fields.select({
      label: 'Страна',
      options: [
        { label: 'Германия', value: 'de' },
        { label: 'Сербия', value: 'rs' },
        { label: 'Испания', value: 'es' },
        { label: 'Швейцария', value: 'ch' },
        { label: 'Португалия', value: 'pt' },
        { label: 'Франция', value: 'fr' },
        { label: 'Италия', value: 'it' },
        { label: 'Польша', value: 'pl' },
        // Not a real sourcing/delivery country in countries.json — used
        // only to tag vehicle-import cases sourced from China so the
        // /vehicle-import/china/ page can filter for them.
        { label: 'Китай', value: 'cn' },
      ],
      defaultValue: 'de',
    }),
    // Keep in sync with the `service` z.enum in src/content.config.ts —
    // can't import it here (that file pulls in Astro-coupled code).
    service: fields.select({
      label: 'Услуга',
      options: [
        { label: 'Автоподбор', value: 'vehicle-sourcing' },
        { label: 'Выкуп', value: 'vehicle-buyback' },
        { label: 'Проверка', value: 'vehicle-inspection' },
        { label: 'Привоз авто', value: 'vehicle-import' },
      ],
      defaultValue: 'vehicle-sourcing',
    }),
    image: caseImage(),
    gallery: fields.array(caseImage(), {
      label: 'Больше фото',
      itemLabel: (props) => props.value?.filename || 'Фото',
    }),
    date: fields.date({ label: 'Дата', validation: { isRequired: true } }),
    published: fields.checkbox({
      label: 'Опубликован',
      defaultValue: true,
    }),
    translatedFrom: translatedFromField(),
  },
});

export const autoserviceCasesCollection = collection({
  label: 'Кейсы автосервиса',
  slugField: 'title',
  path: 'src/content/autoservice-cases/*/',
  previewUrl:
    '/admin/case-photos?dir=src/content/autoservice-cases&slug={slug}',
  format: { contentField: 'content' },
  schema: {
    title: fields.slug({
      name: { label: 'Заголовок', validation: { isRequired: true } },
    }),
    translations: translationsField(),
    content: fields.markdoc({ label: 'Текст (RU)', extension: 'md' }),
    car: fields.text({ label: 'Автомобиль' }),
    year: fields.integer({ label: 'Год' }),
    servicesApplied: fields.multiselect({
      label: 'Выполненные услуги',
      options: [
        { label: 'Компьютерная диагностика', value: 'diagnostics' },
        { label: 'Техническое обслуживание', value: 'maintenance' },
        { label: 'Подвеска и тормоза', value: 'suspension' },
        { label: 'Двигатель и трансмиссия', value: 'engine' },
        { label: 'Проверка перед покупкой', value: 'prepurchase' },
      ],
    }),
    image: caseImage(),
    gallery: fields.array(caseImage(), {
      label: 'Больше фото',
      itemLabel: (props) => props.value?.filename || 'Фото',
    }),
    date: fields.date({ label: 'Дата', validation: { isRequired: true } }),
    published: fields.checkbox({
      label: 'Опубликован',
      defaultValue: true,
    }),
    translatedFrom: translatedFromField(),
  },
});

export const detailingCasesCollection = collection({
  label: 'Кейсы детейлинга',
  slugField: 'title',
  path: 'src/content/detailing-cases/*/',
  previewUrl: '/admin/case-photos?dir=src/content/detailing-cases&slug={slug}',
  format: { contentField: 'content' },
  schema: {
    title: fields.slug({
      name: { label: 'Заголовок', validation: { isRequired: true } },
    }),
    translations: translationsField(),
    content: fields.markdoc({ label: 'Текст (RU)', extension: 'md' }),
    car: fields.text({ label: 'Автомобиль' }),
    year: fields.integer({ label: 'Год' }),
    // Keep in sync with DETAILING_SERVICES in src/utils/labels.ts — can't
    // import it here (that file pulls in Astro-coupled code). One car can
    // get several detailing services at once (e.g. wrap + ceramic), same
    // multiselect-tag shape as autoserviceCases.servicesApplied above.
    // Only 'Оклейка плёнкой' is live; add options here as new services launch.
    servicesApplied: fields.multiselect({
      label: 'Выполненные услуги',
      options: [{ label: 'Оклейка плёнкой', value: 'wrap' }],
    }),
    image: caseImage(),
    gallery: fields.array(caseImage(), {
      label: 'Больше фото',
      itemLabel: (props) => props.value?.filename || 'Фото',
    }),
    date: fields.date({ label: 'Дата', validation: { isRequired: true } }),
    published: fields.checkbox({
      label: 'Опубликован',
      defaultValue: true,
    }),
    translatedFrom: translatedFromField(),
  },
});
