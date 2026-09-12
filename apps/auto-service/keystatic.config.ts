import { collection, config, fields } from '@keystatic/core';

const APP_ROOT = import.meta.env.PROD ? 'apps/auto-service/' : '';

const photo = () =>
  fields.image({ label: 'Фото', validation: { isRequired: true } });

export default config({
  storage: import.meta.env.PROD
    ? { kind: 'github', repo: 'Zikrasoft/approved_rs' }
    : { kind: 'local' },

  ui: {
    brand: { name: 'AUTOHUB' },
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
          options: [
            { label: 'Диагностика', value: 'diagnostics' },
            { label: 'Плановое ТО', value: 'servicing' },
            { label: 'Тормоза и подвеска', value: 'brakes-suspension' },
            { label: 'Двигатель и коробка', value: 'engine-gearbox' },
            { label: 'Кузов и покраска', value: 'bodywork-painting' },
            {
              label: 'Проверка перед покупкой',
              value: 'pre-purchase-inspection',
            },
          ],
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

    products: collection({
      label: 'Аккумуляторы',
      slugField: 'title',
      path: `${APP_ROOT}src/content/products/*/`,
      format: { contentField: 'content' },
      schema: {
        title: fields.slug({
          name: { label: 'Название', validation: { isRequired: true } },
        }),
        translations: fields.ignored(),
        content: fields.markdoc({ label: 'Описание (RU)', extension: 'md' }),
        brand: fields.text({
          label: 'Бренд',
          validation: { isRequired: true },
        }),
        price: fields.number({
          label: 'Цена, €',
          validation: { isRequired: true },
        }),
        capacityAh: fields.number({
          label: 'Ёмкость, Ah',
          validation: { isRequired: true },
        }),
        crankingA: fields.number({
          label: 'Пусковой ток, A',
          validation: { isRequired: true },
        }),
        polarity: fields.select({
          label: 'Полярность',
          options: [
            { label: 'Обратная (минус слева)', value: 'left' },
            { label: 'Прямая (плюс слева)', value: 'right' },
          ],
          defaultValue: 'left',
        }),
        lengthMm: fields.number({
          label: 'Длина, мм',
          validation: { isRequired: true },
        }),
        widthMm: fields.number({
          label: 'Ширина, мм',
          validation: { isRequired: true },
        }),
        heightMm: fields.number({
          label: 'Высота, мм',
          validation: { isRequired: true },
        }),
        warrantyMonths: fields.number({
          label: 'Гарантия, мес.',
          validation: { isRequired: true },
        }),
        inStock: fields.checkbox({ label: 'В наличии', defaultValue: true }),
        image: photo(),
        fitment: fields.array(
          fields.object({
            make: fields.text({
              label: 'Марка',
              validation: { isRequired: true },
            }),
            model: fields.text({
              label: 'Модель',
              validation: { isRequired: true },
            }),
            yearFrom: fields.integer({
              label: 'С года',
              validation: { isRequired: true },
            }),
            yearTo: fields.integer({
              label: 'По год',
              validation: { isRequired: true },
            }),
          }),
          {
            label: 'Совместимость',
            itemLabel: (props) =>
              [
                props.fields.make.value,
                props.fields.model.value,
                props.fields.yearFrom.value,
              ]
                .filter(Boolean)
                .join(' ') || 'Автомобиль',
          },
        ),
        published: fields.checkbox({
          label: 'Опубликован',
          defaultValue: true,
        }),
        translatedFrom: fields.ignored(),
      },
    }),
  },
});
