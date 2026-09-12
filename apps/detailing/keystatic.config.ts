import { collection, config, fields } from '@keystatic/core';

const APP_ROOT = import.meta.env.PROD ? 'apps/detailing/' : '';

const workImage = () =>
  fields.image({ label: 'Фото', validation: { isRequired: true } });

export default config({
  storage: import.meta.env.PROD
    ? { kind: 'github', repo: 'Zikrasoft/approved_rs' }
    : { kind: 'local' },

  ui: {
    brand: { name: 'PRIZMA' },
  },

  collections: {
    works: collection({
      label: 'Работы',
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
          label: 'Выполненные услуги',
          options: [
            { label: 'Защитная плёнка (PPF)', value: 'zastitna-folija' },
            { label: 'Смена цвета плёнкой', value: 'promena-boje' },
            { label: 'Полировка и керамика', value: 'poliranje-keramika' },
            { label: 'Реставрация руля', value: 'restauracija-volana' },
          ],
        }),
        image: workImage(),
        beforeImage: fields.image({ label: 'Фото «до» (для слайдера)' }),
        gallery: fields.array(workImage(), {
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
