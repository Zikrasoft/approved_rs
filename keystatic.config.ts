import { config, collection, fields } from '@keystatic/core';

export default config({
  storage: { kind: 'github', repo: 'Zikrasoft/approved_rs' },

  collections: {
    cases: collection({
      label: 'Кейсы',
      slugField: 'title',
      path: 'src/content/cases/*',
      format: { contentField: 'content' },
      schema: {
        title: fields.slug({ name: { label: 'Заголовок' } }),
        car: fields.text({ label: 'Автомобиль' }),
        year: fields.integer({ label: 'Год' }),
        price: fields.text({ label: 'Цена' }),
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
        image: fields.image({ label: 'Фото', directory: 'public/cases', publicPath: '/cases/' }),
        date: fields.date({ label: 'Дата' }),
        published: fields.checkbox({ label: 'Опубликован', defaultValue: true }),
        content: fields.markdoc({ label: 'Описание', extension: 'md' }),
      },
    }),
  },
});
