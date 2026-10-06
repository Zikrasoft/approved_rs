import { collection, fields } from '@keystatic/core';
import { SERVICE_LABELS_RU, SERVICE_SLUGS_BY_BRAND } from '@podbor/brands';
import {
  caseImage,
  translationsField,
  translatedFromField,
} from './sharedFields';

const APP_ROOT = import.meta.env.PROD ? 'apps/approved-rs/' : '';

export const casesCollection = collection({
  label: 'Кейсы автоподбора',
  slugField: 'title',
  path: `${APP_ROOT}src/content/cases/*/`,
  previewUrl: '/admin/case-photos?dir=src/content/cases&slug={slug}',
  format: { contentField: 'content' },
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
        { label: 'Китай', value: 'cn' },
      ],
      defaultValue: 'de',
    }),
    service: fields.select({
      label: 'Услуга',
      options: SERVICE_SLUGS_BY_BRAND.approved.map((value) => ({
        label: SERVICE_LABELS_RU[value],
        value,
      })),
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
