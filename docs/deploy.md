# Деплой на Vercel

## Стек

- **Astro v7** — статические сайты, отдельные роуты опционально на SSR
  (`export const prerender = false`)
- **pnpm v11 + Turborepo** — монорепо, приложения в `apps/*`, общие пакеты в
  `packages/*`
- **Vercel** — хостинг. Три отдельных проекта, по одному на приложение
- **GitHub Actions** — единственное место, где реально идёт сборка и деплой
  (`.github/workflows/ci.yml`)

## Три сайта — один репозиторий

| Приложение          | Домен         | Бренд                    | Что деплоит                                                                                 |
| ------------------- | ------------- | ------------------------ | ------------------------------------------------------------------------------------------- |
| `apps/approved-rs`  | `approved.rs` | Approved.rs — автоподбор | сайт + `/api/leads`, `/api/contact-click`, `/api/telegram-webhook`, `/api/reminders` (cron) |
| `apps/auto-service` | `carlab.rs`   | CarLab — автосервис      | сайт + `/api/leads`, `/api/contact-click`                                                   |
| `apps/detailing`    | `details.rs`  | Details — детейлинг      | сайт + `/api/leads`, `/api/contact-click`                                                   |

Каждое приложение владеет своим `astro.config.mjs`, `vercel.json`,
`keystatic.config.ts` и `.env*`. Vercel CLI определяет проект по рабочей
директории, поэтому каждая деплой-джоба целиком выполняется из своей
`apps/<app>`.

**Один бот, один чат, одно хранилище заявок, три бренда.** Telegram позволяет
ровно один webhook URL на бота, поэтому `api/telegram-webhook.ts` и
`api/reminders.ts` живут только в `apps/approved-rs`. Все три приложения пишут
в один и тот же `data/leads.json` в одном Vercel Blob store и разделяются полем
`brand` у заявки — его проставляет сервер (`createNotifyLead({ brand })`),
посетитель задать его не может.

> Пути без префикса в этом документе — относительно приложения, о котором идёт
> речь (`vercel.json` в разделе про approved.rs = `apps/approved-rs/vercel.json`).
> В корне репозитория лежат только `.github/`, конфиги линтеров, `pnpm-lock.yaml`
> и «пустой» `vercel.json` с одним `git.deploymentEnabled: false`.

> Переименование в CarLab / Details завершено: старых плейсхолдеров в коде не
> осталось. Единственные вхождения `PRIZMA` / `AutoHub` — фикстуры в тестах
> `packages/lead-crm`, где бренд это произвольная строка.

---

## Как устроен деплой

### Vercel ничего не собирает

`git.deploymentEnabled: false` (корневой `vercel.json`, продублировано в
`apps/approved-rs/vercel.json`) отключает собственный git-триггер Vercel.
Git-интеграция читает конфиг из корня репозитория, а не из директории
приложения, — поэтому файл в корне и существует, только ради этой строчки.
Без неё каждый пуш в любую ветку запускал бы падающий preview-билд.

Собирает и деплоит GitHub Actions:

- джоба `deploy` — `apps/approved-rs`;
- джоба `deploy-brand-site` — матрица из `detailing` и `auto-service`.

Обе делают одно и то же из своей директории приложения:

```bash
pnpm exec vercel pull --yes --environment=production
pnpm exec vercel build --prod
pnpm exec vercel deploy --prebuilt --prod --archive=tgz
```

Проект в Vercel нужен только чтобы хранить переменные окружения, домен и быть
целью деплоя. Настройки сборки в дашборде значения не имеют — они уже
зафиксированы в `vercel.json` каждого приложения:

```json
{
  "framework": "astro",
  "buildCommand": "pnpm run build",
  "installCommand": "pnpm install",
  "outputDirectory": "dist"
}
```

Раньше сборку делал сам Vercel через git-интеграцию (`ignoreCommand`,
`scripts/vercel-ignore-build.sh`) — но так проверки гонялись дважды (в GitHub
Actions и заново в контейнере Vercel), и несовпадение версии pnpm между ними
однажды привело к тому, что реальные деплои с новым контентом молча
пропускались («Canceled by Ignored Build Step», без явной ошибки). Теперь
проверка ровно одна, и деплоится именно тот коммит, который её прошёл.

### Порядок джоб

`check` (lint/prettier/typecheck/test) → `translate` → `deploy` и
`deploy-brand-site` параллельно, каждая только если предыдущая прошла.
`deploy*` запускаются только на `main`.

`translate` идёт до деплоя, а не параллельно ему: скрипты перевода
отрабатывают, коммит с переводами уходит в ту же ветку, и деплой-джобы
чекаутят именно тот SHA, который остался после неё
(`needs.translate.outputs.sha`). Если переводить было нечего, SHA — исходный
коммит пуша. Так в прод физически не может уехать контент без переводов, и
деплой на пуш ровно один.

Всё это один воркфлоу и один прогон. Раньше перевод жил отдельным файлом
(`translate.yml`), а `ci.yml` ждал его завершения через `workflow_run` —
и решал джобой `gate`, деплоить сейчас или отложить до после-переводного
прогона. `gate` отвечал на вопрос «тронул ли пуш контент?» по списку файлов
из push-payload, а `paths:`-фильтр второго воркфлоу — по реальному диффу;
на мерж-коммитах эти два ответа расходились, и `main` деплоился дважды.

`environment: production` в деплой-джобах — обычный GitHub Environment,
создаётся сам при первом запуске, без правил защиты.

### Следствие: переменные окружения живут в проекте Vercel

`vercel pull` скачивает переменные production-окружения проекта в
`.vercel/.env.production.local`, и `vercel build` собирает уже с ними. То есть:

- **переменные задаются в дашборде Vercel, а не в секретах GitHub.** В GitHub
  лежат только токен/ID для доступа к Vercel и `OPENAI_API_KEY` (см. ниже);
- **отсутствие переменной не ломает сборку.** `PUBLIC_*` инлайнятся в HTML на
  этапе билда, и незаданная переменная без фолбэка превращается в
  `undefined` прямо в разметке (`https://t.me/undefined`). Серверные
  переменные проверяются в рантайме и роняют роут в 500 уже в проде;
- **изменение переменной применяется только после нового деплоя** — старая
  сборка уже содержит старое значение внутри HTML.

---

## Переменные окружения

Задаются в Vercel Dashboard → нужный проект → Settings → Environment Variables
(окружение Production; Preview не используется — preview-деплоев нет).

`PUBLIC_*` доступны в браузере — секреты туда не класть.

### Публичные (контакты, инлайнятся в HTML)

| Переменная               | approved.rs | carlab.rs | details.rs | Фолбэк в коде                   | Без неё                       |
| ------------------------ | ----------- | --------- | ---------- | ------------------------------- | ----------------------------- |
| `PUBLIC_TG_MANAGER`      | ✅ обяз.    | ✅        | ✅         | нет / заглушка / заглушка       | ссылка на `t.me/undefined`    |
| `PUBLIC_WHATSAPP_NUMBER` | ✅ обяз.    | ✅        | ✅         | нет / `PUBLIC_PHONE_NUMBER`     | битая ссылка WhatsApp         |
| `PUBLIC_VIBER_NUMBER`    | ✅ обяз.    | ✅        | ✅         | нет / `PUBLIC_PHONE_NUMBER`     | битая ссылка Viber            |
| `PUBLIC_PHONE_NUMBER`    | —           | ✅        | ✅         | номер-заглушка в `constants.ts` | сайт показывает чужой номер   |
| `PUBLIC_THREADS_CHANNEL` | ✅ обяз.    | —         | —          | нет                             | битая ссылка Threads + schema |
| `PUBLIC_INSTAGRAM`       | —           | —         | ✅         | `details.studio` (заглушка)     | сайт показывает чужой аккаунт |

У approved.rs в `src/utils/constants.ts` стоит `!` без фолбэка — незаданная
переменная даёт `undefined` в вёрстке. У carlab.rs и details.rs есть фолбэки
на номера-заглушки: сайт не сломается, но будет показывать неправильный
контакт — это хуже, чем битая ссылка, потому что незаметно.

`PUBLIC_WHATSAPP_NUMBER` у approved.rs заодно служит номером для обычного
звонка (`PHONE_NUMBER` там алиас на неё).

### Telegram (нужны всем трём проектам)

| Переменная                | approved.rs | carlab.rs | details.rs | Без неё                                                          |
| ------------------------- | ----------- | --------- | ---------- | ---------------------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN`      | ✅          | ✅        | ✅         | `/api/leads` и `/api/contact-click` отвечают 500                 |
| `TELEGRAM_BOT_USERNAME`   | ✅          | ✅        | ✅         | то же — 500                                                      |
| `TELEGRAM_GROUP_ID`       | ✅          | ✅        | ✅         | то же — 500                                                      |
| `TELEGRAM_OWNER_ID`       | ✅          | ✅        | ✅         | заявки этого бренда не приходят владельцу в личку                |
| `TELEGRAM_ADMIN_ID`       | ✅          | ✅        | ✅         | заявки этого бренда не приходят админу в личку                   |
| `TELEGRAM_WEBHOOK_SECRET` | ✅          | —         | —          | `/api/telegram-webhook` отвечает 401 на всё — кнопки бота мертвы |

> **Главная ловушка при заведении новых проектов.** Все три `src/lib/crmBot.ts`
> вызывают `requireEnv('TELEGRAM_BOT_TOKEN')`, `requireEnv('TELEGRAM_BOT_USERNAME')`
> и `requireEnv('TELEGRAM_GROUP_ID')` на верхнем уровне модуля. Роуты
> `/api/leads` и `/api/contact-click` — `prerender = false`, поэтому **сборка
> проходит успешно**, а падает уже первый реальный запрос в проде. Легко
> выкатить «зелёный» деплой с нерабочей формой.

`TELEGRAM_OWNER_ID` / `TELEGRAM_ADMIN_ID` — числовые Telegram user id (не
`@username`, взять у [@userinfobot](https://t.me/userinfobot)), через запятую
если у человека несколько аккаунтов (`111,222`). Отсутствие не роняет роут —
просто личные сообщения по заявкам этого бренда никуда не уходят. Ставить во
всех трёх проектах одни и те же id.

Бот один на все бренды: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` и
`TELEGRAM_GROUP_ID` во всех трёх проектах одинаковые.

### Хранилище и cron

| Переменная              | approved.rs | carlab.rs | details.rs | Без неё                                                       |
| ----------------------- | ----------- | --------- | ---------- | ------------------------------------------------------------- |
| `BLOB_READ_WRITE_TOKEN` | ✅ авто     | ✅ авто   | ✅ авто    | заявки не сохраняются, роуты падают                           |
| `CRON_SECRET`           | ✅          | —         | —          | `/api/reminders` отвечает 401 — напоминания никогда не уходят |

`BLOB_READ_WRITE_TOKEN` **руками не задавать** — он появляется сам после того,
как Blob store подключён к проекту (см. следующий раздел).

### Keystatic (нужны всем трём проектам)

| Переменная                         | Публичная | Без неё                                 |
| ---------------------------------- | --------- | --------------------------------------- |
| `KEYSTATIC_GITHUB_CLIENT_ID`       | нет       | вход в `/keystatic` в проде не работает |
| `KEYSTATIC_GITHUB_CLIENT_SECRET`   | нет       | то же                                   |
| `KEYSTATIC_SECRET`                 | нет       | то же (подпись сессионной куки)         |
| `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` | **да**    | кнопка входа ведёт в никуда             |

Значения у трёх проектов **разные** — у каждого сайта свой GitHub App, см.
раздел «Keystatic: три GitHub App'а». `KEYSTATIC_SECRET` — произвольная
случайная строка, своя для каждого проекта.

### `SITE`

Отдельная история: в дашборде её задавать не нужно.

- URL сайта захардкожен как `site:` в `astro.config.mjs` каждого приложения, и
  именно оттуда Astro наполняет `import.meta.env.SITE`, которую читает
  `src/utils/constants.ts`. Переменная окружения `SITE` на это значение не
  влияет — Astro инлайнит в `import.meta.env` только `PUBLIC_*` и собственные
  встроенные ключи;
- `vercel.json` каждого приложения дополнительно кладёт `env.SITE` в рантайм
  функций — на случай, если он кому-то понадобится;
- реально `process.env.SITE` читает только локальный скрипт
  `scripts/register-webhook.ts` (из `.env.local`).

Меняется домен → правится `site:` в `astro.config.mjs` и `env.SITE` в
`vercel.json`, а не переменная в дашборде.

---

## Общий Blob store на три проекта

Все три приложения создают хранилище одинаково:

```ts
createVercelBlobStorage({ path: 'data/leads.json' });
```

Один и тот же ключ. Значит, чтобы заявки всех брендов лежали в одном файле —
а они должны, потому что бот и cron живут только в approved.rs и обязаны
видеть заявки всех трёх брендов — **store должен быть один, подключённый ко
всем трём проектам**.

1. Vercel Dashboard → Storage → Create → Blob (один раз, не по одному на проект)
2. У созданного store → Connect Project → подключить все три проекта
3. В каждом проекте после этого сам появится `BLOB_READ_WRITE_TOKEN`,
   указывающий на этот же store

Никогда не задавать `BLOB_READ_WRITE_TOKEN` руками: значение, скопированное
из другого проекта, легко разъедет со store, и часть заявок уедет в файл,
которого бот не видит.

Разделение по брендам — поле `brand` у заявки (`Approved.rs` / `CarLab` /
`Details`), проставляется сервером. Отдельных файлов нет.

---

## Keystatic: три GitHub App'а

Все три `keystatic.config.ts` в проде ходят в один и тот же репозиторий
(`storage: { kind: 'github', repo: 'Zikrasoft/approved_rs' }`) и различаются
только префиксом пути (`APP_ROOT = 'apps/<app>/'`). Но OAuth-callback у
GitHub App фиксированный и привязан к домену:

```
https://<домен>/api/keystatic/github/oauth/callback
```

Три домена — три отдельных GitHub App'а, каждый установлен на тот же
репозиторий `Zikrasoft/approved_rs`.

Для каждого:

1. GitHub → Settings → Developer settings → GitHub Apps → New GitHub App
2. Callback URL — как выше, с доменом соответствующего сайта
3. Права: Repository permissions → Contents: Read and write
4. Install App → на репозиторий `Zikrasoft/approved_rs`
5. Сгенерировать client secret
6. В соответствующий проект Vercel положить `KEYSTATIC_GITHUB_CLIENT_ID`,
   `KEYSTATIC_GITHUB_CLIENT_SECRET`, `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` (slug
   из URL приложения) и свой случайный `KEYSTATIC_SECRET`

Локальная разработка через GitHub App не ходит: `import.meta.env.PROD` там
`false`, и Keystatic пишет прямо в рабочую копию (`storage: { kind: 'local' }`).

---

## Секреты GitHub Actions

Settings → Secrets and variables → Actions:

| Секрет                           | Для чего                                 | Где взять                                                      |
| -------------------------------- | ---------------------------------------- | -------------------------------------------------------------- |
| `OPENAI_API_KEY`                 | джоба `translate` (автоперевод контента) | OpenAI. **Только в GitHub, на Vercel не нужен**                |
| `VERCEL_TOKEN`                   | все деплой-джобы                         | [vercel.com/account/tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID`                  | все деплой-джобы                         | `.vercel/project.json` → `orgId` после `vercel link`           |
| `VERCEL_PROJECT_ID`              | деплой approved.rs                       | Project Settings → General нужного проекта                     |
| `VERCEL_PROJECT_ID_AUTO_SERVICE` | деплой carlab.rs                         | то же, у проекта carlab.rs                                     |
| `VERCEL_PROJECT_ID_DETAILING`    | деплой details.rs                        | то же, у проекта details.rs                                    |

> **Внимание: незаданный `VERCEL_PROJECT_ID_*` не подсвечивается никак.** Шаг
> `guard` в джобе `deploy-brand-site` проверяет, что секрет непустой, и если
> он пустой — **пропускает все остальные шаги и оставляет джобу зелёной**. В
> Actions это выглядит как успешный деплой; в логе `guard` будет строчка
> «`VERCEL_PROJECT_ID_… is not set — skipping the … deploy`». Единственный
> способ заметить — прочитать лог или увидеть, что на сайте нет изменений.
> У approved.rs такого guard нет: без `VERCEL_PROJECT_ID` джоба `deploy`
> честно падает на `vercel pull`.

---

## Создание нового проекта в Vercel

> **Нельзя сделать до мержа.** Vercel показывает в выборе Root Directory
> только те директории, которые есть в **дефолтной ветке** репозитория. Пока
> `apps/auto-service` и `apps/detailing` живут только в `feature/split`,
> выбрать их не получится. Сначала мерж в `main`, потом создание проектов.

Для каждого из двух новых сайтов:

1. Vercel → Add New → Project → Import Git Repository → тот же репозиторий
   `Zikrasoft/approved_rs`
2. **Root Directory** → `apps/auto-service` (или `apps/detailing`)
3. Framework Preset: **Astro**. Build/Install/Output Command не трогать —
   они уже заданы в `vercel.json` приложения и переопределят дашборд
4. Environment Variables — по таблицам выше (публичные контакты, Telegram,
   Keystatic). Можно добавить сразу на экране импорта
5. Deploy — первый билд Vercel сделает сам; он нужен только чтобы проект
   ожил. Дальше деплоит GitHub Actions
6. Settings → Domains → добавить `carlab.rs` (или `details.rs`), прописать
   DNS у регистратора по инструкции Vercel
7. Storage → подключить **тот же** Blob store, что и у approved.rs
8. Settings → General → скопировать Project ID в секрет GitHub
   (`VERCEL_PROJECT_ID_AUTO_SERVICE` / `VERCEL_PROJECT_ID_DETAILING`)

Git-триггер отключать в дашборде не нужно — его выключает
`git.deploymentEnabled: false` в корневом `vercel.json`.

---

## Порядок первого выката

1. `feature/split` проходит CI (`check` зелёный) и мержится в `main`
2. После мержа — только тогда — создаются два новых проекта Vercel
   (см. раздел выше) вместе с их доменами и env-переменными
3. Создаётся (если ещё нет) один Blob store и подключается ко всем трём
   проектам
4. Заводятся три GitHub App'а для Keystatic, их переменные раскладываются
   по проектам
5. Project ID обоих новых проектов кладутся в секреты GitHub
6. Любой следующий пуш в `main` (или ручной запуск `ci.yml` через
   workflow_dispatch) выкатывает все три сайта
7. Проверить в логе джобы `deploy-brand-site`, что `guard` не пропустил
   деплой (см. предупреждение выше)
8. Только для approved.rs: зарегистрировать Telegram webhook (следующий раздел)
9. Пройтись по чек-листу в конце документа для каждого из трёх доменов

Порядок 2 → 3 → 4 → 5 важен: деплой, запущенный раньше, чем в проекте
появятся переменные, соберётся успешно и выложит сайт с `undefined` в
контактах и с падающей формой.

---

## Автоперевод контента

Кейсы (`src/content/{cases,autoservice-cases,detailing-cases}`, `works`,
`products`) и UI-копия (`src/content/i18n/*.yaml`) переводятся автоматически.
Админ в Keystatic пишет только русские поля — ни один из четырёх языков в
`translations` там не обязателен, потому что Keystatic не умеет запускать
API-вызов из своей формы, так что кнопки «Перевести» там в принципе быть не
может.

Вместо неё — джоба `translate` в `.github/workflows/ci.yml`: при каждом пуше
(**в любую ветку**, не только `main`) она проходит по всем `apps/*/` и
прогоняет каждый найденный скрипт (`translate-cases`, `translate-works`,
`translate-i18n`), после чего коммитит результат обратно — так переводы уже
есть в фиче-ветке к моменту мержа, а не появляются только после него.

Это безопасно гонять на всех ветках: `git.deploymentEnabled` теперь `false`
целиком, Vercel больше не деплоит по git-пушу ни для одной ветки — коммит с
переводом на фиче-ветке в принципе не может запустить лишний билд. На `main`
деплой-джобы идут следом за `translate` в том же прогоне и чекаутят именно
тот коммит, который она оставила после себя.

Скрипты отличают «перевода ещё нет» от «RU-текст изменился»: хэш исходного
RU-текста хранится рядом с переводом (`translatedFrom`), и переводы
пересобираются заново только если этот хэш разошёлся с текущим RU. Если RU не
менялся — трогаются только реально отсутствующие языки.

Без `OPENAI_API_KEY` джоба падает на шаге перевода — существующий контент это
не затронет, только новые/изменённые тексты останутся без перевода до
следующего успешного запуска. Ручной прогон — обязательно изнутри приложения
(скрипты ищут контент относительно текущей директории):

```bash
cd apps/approved-rs
node --env-file=.env --experimental-strip-types scripts/translate-cases.ts
```

---

## Telegram webhook (только approved.rs)

Группа получает только короткий тизер заявки («#123 · Иван · Автоподбор ·
статус») и кнопку-ссылку «Открыть в боте» — всё управление (статусы,
редактирование, архив, деньги) происходит в личке с ботом. Заявки хранятся
в Vercel Blob (`data/leads.json`, приватный доступ), без внешней БД.

Владелец и админ должны один раз написать боту `/start`, прежде чем бот
сможет слать им личные сообщения (в т.ч. напоминания по крону) — Telegram
запрещает боту начинать переписку первым.

Webhook регистрируется **один раз на бота**, и указывает на approved.rs:
у carlab.rs и details.rs роута `/api/telegram-webhook` просто нет. Обязательно
с `secret_token`, равным `TELEGRAM_WEBHOOK_SECRET` проекта approved.rs — без
совпадения эндпоинт отвечает 401 на любой запрос:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://approved.rs/api/telegram-webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Проверить:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

То же самое делает `apps/approved-rs/scripts/register-webhook.ts`, читая
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` и `SITE` из окружения:

```bash
cd apps/approved-rs
node --env-file=.env.local --experimental-strip-types scripts/register-webhook.ts
```

> Скрипт до 2026-09-13 регистрировал несуществующий `${SITE}/api/telegram` и
> передавал `allowed_updates: ['callback_query']`, из-за чего личные сообщения
> боту и ответы на его промпты про суммы сделок до вебхука не доходили. Если
> вебхук регистрировали им раньше — перерегистрируйте.

---

## Cron напоминаний (только approved.rs)

`apps/approved-rs/vercel.json`:

```json
"crons": [{ "path": "/api/reminders", "schedule": "0 8 * * *" }]
```

Каждый день в 08:00 UTC Vercel дёргает `/api/reminders`, подставляя
`Authorization: Bearer $CRON_SECRET` — роут разбирает отложенные («напомни
мне») заявки, у которых подошёл срок, и возвращает их владельцу. Без
`CRON_SECRET` в проекте роут отвечает 401, и напоминания молча не приходят.

Cron привязан к проекту, а не к боту: у двух других проектов секции `crons`
в `vercel.json` нет, добавлять её не нужно — иначе одни и те же напоминания
уедут по несколько раз.

---

## Geo-баннер (только approved.rs)

`src/middleware.ts` на главной читает заголовок `x-vercel-ip-country` и, если
страна есть в списке (DE, RS, ES, FR, IT, PL), кладёт её в
`Astro.locals.suggestedCountry` — главная показывает баннер с предложением
перейти на страницу своей страны. **Это не редирект**: URL не меняется,
посетитель сам решает. Если стоит кука `geo-banner-dismissed`, баннер не
показывается вообще.

Поэтому главная approved.rs — единственная страница сайта с
`prerender = false`: без SSR заголовка страны не увидеть. Заголовок ставит
Vercel Edge, локально его нет, так что в `astro dev` баннер не появляется
никогда.

У carlab.rs и details.rs geo-логики нет — их middleware занимается только
локалями.

---

## Кастомный домен

1. Vercel Dashboard → нужный проект → Settings → Domains
2. Добавить домен (`approved.rs` / `carlab.rs` / `details.rs`)
3. Прописать DNS-записи (A или CNAME) у регистратора согласно инструкции Vercel
4. Проверить, что `site:` в `astro.config.mjs` этого приложения и `env.SITE`
   в его `vercel.json` совпадают с доменом — от них зависят канонические
   ссылки, sitemap и OG-теги

---

## Pnpm на Vercel

Реальный деплой (`git push origin main` → `ci.yml`) этого вообще не касается:
`vercel build`/`vercel deploy` запускаются из GitHub Actions, где
`pnpm/action-setup` уже поставил pnpm из `packageManager` в корневом
`package.json` (сейчас 11.22.0) — `vercel build` выполняет
`installCommand`/`buildCommand` тем же процессом, а не в отдельном
Vercel-контейнере со своей версией pnpm.

Ниже актуально только для ручного деплоя из дашборда Vercel (кнопка
Redeploy) или git-триггера, если `git.deploymentEnabled` когда-нибудь снова
включат — в обоих случаях сборку выполняет сам Vercel:

- Vercel определяет версию pnpm по `lockfileVersion` в `pnpm-lock.yaml`
- pnpm v11 официально им не поддерживается (максимум — 10)

Поэтому `pnpm-workspace.yaml` держит список разрешённых сборок дважды, в
формате обеих версий:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'

allowBuilds: # pnpm v11
  esbuild: true
  sharp: true
  '@parcel/watcher': true

onlyBuiltDependencies: # pnpm v9/v10 (Vercel)
  - esbuild
  - sharp
  - '@parcel/watcher'
```

---

## Проверка после деплоя

Для каждого из трёх доменов:

- [ ] Главная открывается, редирект `/` → `/<локаль>/` работает
- [ ] В контактах нет `undefined` (проверить ссылки Telegram/WhatsApp/Viber/телефон)
- [ ] Форма отправляет заявку → приходит в общую Telegram-группу с правильным
      названием бренда
- [ ] Клик по кнопке звонка тоже долетает до Telegram (`/api/contact-click`)
- [ ] `/keystatic` пускает внутрь по GitHub и сохраняет правку в репозиторий
- [ ] HTTPS и кастомный домен активны

Дополнительно для approved.rs:

- [ ] Кнопки в личке с ботом работают (значит webhook и
      `TELEGRAM_WEBHOOK_SECRET` сошлись)
- [ ] Заявки всех трёх брендов видны боту (значит Blob store действительно
      общий)
- [ ] Баннер по гео появляется при заходе из DE/RS/ES (VPN)
