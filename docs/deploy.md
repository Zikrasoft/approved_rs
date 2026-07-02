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
| `PUBLIC_TG_CHANNEL` | Username Telegram канала (без @) | — |
| `TELEGRAM_BOT_TOKEN` | Токен бота для приёма заявок | [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_CHANNEL_ID` | ID канала/группы куда слать заявки | `@username` или `-100...` |
| `DATABASE_URL` | Строка подключения Neon Postgres | [neon.tech](https://neon.tech) |

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

После первого деплоя нужно зарегистрировать webhook бота:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://approved.rs/api/telegram"
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
