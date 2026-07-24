import { config, collection, fields } from '@keystatic/core';

const caseImage = () => fields.image({ label: 'Фото', directory: 'public/cases', publicPath: '/cases/' });

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
  },
});
