import { config, collection, fields } from '@keystatic/core';

// No directory/publicPath override: Keystatic then stores each image next to
// its entry (e.g. src/content/cases/<slug>/photo.jpg, referenced as a
// relative path) — required by content.config.ts's `image()` schema, which
// needs a locally-resolvable path to optimize via astro:assets at build
// time, not a public/ URL string.
const caseImage = () => fields.image({ label: 'Фото' });

export default config({
  storage: { kind: 'github', repo: 'Zikrasoft/approved_rs' },

  collections: {
    cases: collection({
      label: 'Кейсы автоподбора',
      slugField: 'title',
      path: 'src/content/cases/*',
      format: { contentField: 'content' },
      schema: {
        title: fields.slug({ name: { label: 'Заголовок' } }),
        car: fields.text({ label: 'Автомобиль' }),
        year: fields.integer({ label: 'Год' }),
        price: fields.object(
          {
            value: fields.text({ label: 'Цена' }),
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
          { layout: [8, 4] }
        ),
        country: fields.select({
          label: 'Страна',
          options: [
            { label: 'Германия', value: 'de' },
            { label: 'Сербия', value: 'rs' },
            { label: 'Испания', value: 'es' },
          ],
          defaultValue: 'de',
        }),
        service: fields.select({
          label: 'Услуга',
          options: [
            { label: 'Автоподбор', value: 'autopodbor' },
            { label: 'Доставка', value: 'delivery' },
            { label: 'Подбор + доставка', value: 'combined' },
            { label: 'Выкуп', value: 'buyout' },
            { label: 'Проверка', value: 'inspection' },
          ],
          defaultValue: 'autopodbor',
        }),
        image: caseImage(),
        gallery: fields.array(caseImage(), { label: 'Больше фото', itemLabel: props => props.value || 'Фото' }),
        date: fields.date({ label: 'Дата' }),
        published: fields.checkbox({ label: 'Опубликован', defaultValue: true }),
        content: fields.markdoc({ label: 'Описание', extension: 'md' }),
      },
    }),
    autoserviceCases: collection({
      label: 'Кейсы автосервиса',
      slugField: 'title',
      path: 'src/content/autoservice-cases/*',
      format: { contentField: 'content' },
      schema: {
        title: fields.slug({ name: { label: 'Заголовок' } }),
        car: fields.text({ label: 'Автомобиль' }),
        year: fields.integer({ label: 'Год' }),
        price: fields.object(
          {
            value: fields.text({ label: 'Цена' }),
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
          { layout: [8, 4] }
        ),
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
        gallery: fields.array(caseImage(), { label: 'Больше фото', itemLabel: props => props.value || 'Фото' }),
        date: fields.date({ label: 'Дата' }),
        published: fields.checkbox({ label: 'Опубликован', defaultValue: true }),
        content: fields.markdoc({ label: 'Описание', extension: 'md' }),
      },
    }),
  },
});
