import { collection, config, fields } from '@keystatic/core';
import { SERVICE_LABELS_RU, SERVICE_SLUGS_BY_BRAND } from '@podbor/brands';
import { SITE_NAME } from './src/utils/constants';

const APP_ROOT = import.meta.env.PROD ? 'apps/auto-service/' : '';

const photo = () =>
  fields.image({ label: 'Фото', validation: { isRequired: true } });

export default config({
  storage: import.meta.env.PROD
    ? { kind: 'github', repo: 'Zikrasoft/approved_rs' }
    : { kind: 'local' },

  ui: {
    brand: { name: SITE_NAME },
  },

  collections: {
    works: collection({
      label: 'Примеры работ',
      slugField: 'title',
      path: `${APP_ROOT}src/content/works/*/`,
      format: { contentField: 'content' },
      schema: {
        title: fields.slug({
          name: { label: 'Заголовок', validation: { isRequired: true } },
        }),
        translations: fields.ignored(),
        content: fields.markdoc({ label: 'Текст (RU)', extension: 'md' }),
        car: fields.text({
          label: 'Автомобиль',
          validation: { isRequired: true },
        }),
        year: fields.integer({ label: 'Год' }),
        servicesApplied: fields.multiselect({
          label: 'Выполненные работы',
          options: SERVICE_SLUGS_BY_BRAND.carlab.map((value) => ({
            label: SERVICE_LABELS_RU[value],
            value,
          })),
        }),
        image: photo(),
        gallery: fields.array(photo(), {
          label: 'Больше фото',
          itemLabel: (props) => props.value?.filename || 'Фото',
        }),
        date: fields.date({ label: 'Дата', validation: { isRequired: true } }),
        published: fields.checkbox({
          label: 'Опубликован',
          defaultValue: true,
        }),
        translatedFrom: fields.ignored(),
      },
    }),
  },
});
