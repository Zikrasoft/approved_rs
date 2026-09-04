import { config, collection, fields } from '@keystatic/core';

// No directory/publicPath override: Keystatic then stores each image next to
// its entry (e.g. src/content/cases/<slug>/photo.jpg, referenced as a
// relative path) — required by content.config.ts's `image()` schema, which
// needs a locally-resolvable path to optimize via astro:assets at build
// time, not a public/ URL string.
const caseImage = () =>
  fields.image({ label: 'Фото', validation: { isRequired: true } });

// EN/SR/ES/DE translation of this case's title + body, written by
// .github/workflows/translate-cases.yml (scripts/translate-cases.ts) after
// every push that touches a case file — never by hand. Keystatic has no
// field type that can run an API call from inside its own form (confirmed
// against 0.6.9, the latest release — same fixed field list as our 0.5.50),
// so there was never a "Translate" button here to begin with.
// `fields.ignored()` keeps the whole nested en/sr/es/de object out of the
// form (nothing to accidentally hand-edit and fight the bot over) while
// round-tripping it untouched on save, same reasoning as translatedFrom
// below.
const translationsField = () => fields.ignored();

// Written by translate-cases.ts (see comment on translationsField above), not
// by hand — Keystatic's schema rejects unknown frontmatter keys, so this has
// to be declared even though the admin never touches it. `fields.ignored()`
// renders no input at all (not just disabled) and passes the stored value
// through untouched on save, so the bot's hash can't be edited or nuked by
// hand and doesn't clutter the form.
const translatedFromField = () => fields.ignored();

export default config({
  // Local dev reads/writes the working tree directly — no GitHub OAuth,
  // and edits show up immediately without a commit+push round trip. On
  // Vercel the filesystem is ephemeral, so production has to go through
  // GitHub's API to actually persist anything.
  storage: import.meta.env.PROD
    ? { kind: 'github', repo: 'Zikrasoft/approved_rs' }
    : { kind: 'local' },

  collections: {
    cases: collection({
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
    }),
    autoserviceCases: collection({
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
    }),
    detailingCases: collection({
      label: 'Кейсы детейлинга',
      slugField: 'title',
      path: 'src/content/detailing-cases/*/',
      previewUrl:
        '/admin/case-photos?dir=src/content/detailing-cases&slug={slug}',
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
    }),
  },
});
