import { config, collection, fields } from '@keystatic/core';

// No directory/publicPath override: Keystatic then stores each image next to
// its entry (e.g. src/content/cases/<slug>/photo.jpg, referenced as a
// relative path) — required by content.config.ts's `image()` schema, which
// needs a locally-resolvable path to optimize via astro:assets at build
// time, not a public/ URL string.
const caseImage = () => fields.image({ label: 'Фото', validation: { isRequired: true } });

// EN/SR translation of this case's title + body, right on the same entry —
// everything else (photo, price, year, country) is shared across locales
// and stays ru-only. `markdoc.inline()` (not the plain `markdoc()` used for
// the ru `content` field below) gives the same rich-text toolbar but stores
// the result as a plain markdown string alongside the other fields, since
// only one field per file can be the real document body (format.contentField
// below) — the site parses this string with `marked` at render time.
// Required: every new case ships translated in all 3 languages from day
// one, not RU-only "for now" (see CLAUDE.md). The title field enforces this
// (validation.isRequired); markdoc.inline has no such option — Keystatic
// will let a case save with an empty translated body, so this is an
// editorial rule to follow, not one the form can fully enforce. The site's
// own fallback to the ru original still exists as a safety net for
// anything published before this rule, not as an intended workflow.
const translationField = (label: string, suffix: string) => fields.object({
  title: fields.text({ label: `Заголовок (${suffix})`, validation: { isRequired: true } }),
  body: fields.markdoc.inline({ label: `Текст (${suffix})` }),
}, { label });

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
      format: { contentField: 'content' },
      // Plain stacked form, full width for every field: this entry has
      // three real rich-text bodies (ru/en/sr), and Keystatic's 'content'
      // layout only gives one of them the wide main pane — the other two
      // get squeezed into the narrow metadata sidebar, worse for
      // translating, not better. Fields stay top-level (content.config.ts's
      // schema and every reader of c.data.* expects that shape) — reordered
      // so title → translations → ru text come first, ahead of the
      // car/photo/publish metadata, since translating an existing case is
      // the common edit.
      schema: {
        title: fields.slug({ name: { label: 'Заголовок', validation: { isRequired: true } } }),
        translations: fields.object({
          en: translationField('English', 'EN'),
          sr: translationField('Srpski', 'SR'),
        }, { label: 'Переводы' }),
        content: fields.markdoc({ label: 'Текст (RU)', extension: 'md' }),
        car: fields.text({ label: 'Автомобиль', validation: { isRequired: true } }),
        year: fields.integer({ label: 'Год', validation: { isRequired: true } }),
        price: fields.object(
          {
            value: fields.text({ label: 'Цена', validation: { isRequired: true } }),
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
            { label: 'Швейцария', value: 'ch' },
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
        gallery: fields.array(caseImage(), { label: 'Больше фото', itemLabel: props => props.value?.filename || 'Фото' }),
        date: fields.date({ label: 'Дата', validation: { isRequired: true } }),
        published: fields.checkbox({ label: 'Опубликован', defaultValue: true }),
      },
    }),
    autoserviceCases: collection({
      label: 'Кейсы автосервиса',
      slugField: 'title',
      path: 'src/content/autoservice-cases/*/',
      format: { contentField: 'content' },
      schema: {
        title: fields.slug({ name: { label: 'Заголовок', validation: { isRequired: true } } }),
        translations: fields.object({
          en: translationField('English', 'EN'),
          sr: translationField('Srpski', 'SR'),
        }, { label: 'Переводы' }),
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
        gallery: fields.array(caseImage(), { label: 'Больше фото', itemLabel: props => props.value?.filename || 'Фото' }),
        date: fields.date({ label: 'Дата', validation: { isRequired: true } }),
        published: fields.checkbox({ label: 'Опубликован', defaultValue: true }),
      },
    }),
  },
});
