# Деплой на Vercel

## Стек

- **Astro v7** — статический сайт + Edge middleware
- **pnpm v11** локально, **pnpm v10** на Vercel (по lockfile `v9.0`)
- **Vercel** — хостинг, Edge Middleware для geo-таргетинга

---

## Первый деплой

### 1. Подключить репозиторий

1. Зайти на [vercel.com](https://vercel.com) → New Project
2. Import Git Repository → выбрать репо
3. Framework Preset: **Astro** (должен определиться автоматически)

### 2. Переменные окружения

В Vercel Dashboard → Settings → Environment Variables добавить:

| Переменная | Описание | Где взять |
|---|---|---|
| `SITE` | Публичный URL сайта, напр. `https://approved.rs` | Домен проекта |
| `PUBLIC_TG_MANAGER` | Username Telegram менеджера (без @) | — |
| `PUBLIC_THREADS_CHANNEL` | Username Threads-канала (без @) | — |
| `TELEGRAM_BOT_TOKEN` | Токен бота для приёма заявок | [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_GROUP_ID` | ID группы куда слать заявки | `@username` или `-100...` |
| `TELEGRAM_WEBHOOK_SECRET` | Секрет для проверки запросов к `/api/telegram-webhook` | Придумать самим, любая случайная строка |
| `TELEGRAM_OWNER_ID` | Telegram user id владельца (числовой, не @username) — доступ к личному меню бота. Через запятую, если у человека несколько аккаунтов (`111,222`) | [@userinfobot](https://t.me/userinfobot) |
| `TELEGRAM_ADMIN_ID` | Telegram user id админа/партнёра — доступ к финансовому меню бота. Тоже можно через запятую | [@userinfobot](https://t.me/userinfobot) |
| `TELEGRAM_BOT_USERNAME` | @username бота без `@`, для deep-link кнопки «Открыть в боте» в группе | [@BotFather](https://t.me/BotFather) или один раз `getMe` |
| `CRON_SECRET` | Секрет для проверки запросов Vercel Cron к `/api/reminders` (шлёт владельцу отложенные «напомни мне» напоминания в срок) | Придумать самим, любая случайная строка |
| `BLOB_READ_WRITE_TOKEN` | Доступ к Vercel Blob (хранилище заявок/сделок) | Автоматически, после подключения Blob store в Storage tab — руками не задавать |

> `PUBLIC_*` переменные доступны в браузере — не класть в них секреты.

### 3. Настройки сборки

В `vercel.json` уже прописано:

```json
{
  "framework": "astro",
  "buildCommand": "pnpm run build",
  "installCommand": "pnpm install",
  "outputDirectory": "dist"
}
```

Менять не нужно.

### 4. Задеплоить

```bash
git push origin main
```

Vercel автоматически запустит деплой при пуше в `main`.

---

## Telegram webhook

Группа получает только короткий тизер заявки («#123 · Иван · Автоподбор ·
статус») и кнопку-ссылку «Открыть в боте» — всё управление (статусы,
редактирование, архив, деньги) происходит в личке с ботом. Заявки хранятся
в Vercel Blob (`data/leads.json`, приватный доступ), без внешней БД.
Владелец и админ должны один раз написать боту `/start`, прежде чем бот
сможет слать им личные сообщения (в т.ч. напоминания по крону). После
первого деплоя нужно зарегистрировать webhook, задав `secret_token` (то же
значение, что в `TELEGRAM_WEBHOOK_SECRET`) — без него эндпоинт отвечает 401
на любой запрос:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://approved.rs/api/telegram-webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Проверить:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

---

## Geo-таргетинг

`middleware.ts` в корне перехватывает запросы к `/` и редиректит по стране:

| Страна | Редирект |
|---|---|
| DE | `/de/autopodbor/` |
| RS | `/rs/autopodbor/` |
| ES | `/es/autopodbor/` |
| Остальные | Без редиректа |

Использует заголовок `x-vercel-ip-country` — доступен только на Vercel Edge.  
Локально middleware не работает.

---

## Кастомный домен

1. Vercel Dashboard → Settings → Domains
2. Добавить домен `approved.rs`
3. Прописать DNS-записи (A или CNAME) у регистратора согласно инструкции Vercel
4. После проксирования обновить `SITE` env var если ещё не стоит

---

## Pnpm на Vercel

Vercel определяет версию pnpm по `lockfileVersion` в `pnpm-lock.yaml`:

- `lockfileVersion: 9.0` → pnpm 9 или 10 (не 11)
- pnpm v11 официально не поддерживается Vercel

Локально можно использовать pnpm любой версии. Конфиг совместимости в `pnpm-workspace.yaml`:

```yaml
allowBuilds:          # pnpm v11
  esbuild: true
  sharp: true
onlyBuiltDependencies: # pnpm v9/v10 (Vercel)
  - esbuild
  - sharp
```

---

## Проверка после деплоя

- [ ] Главная открывается
- [ ] Форма отправляет заявку → приходит в Telegram
- [ ] Редирект по гео работает (VPN → DE/RS/ES)
- [ ] HTTPS и кастомный домен активны
