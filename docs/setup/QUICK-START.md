# 🚀 Быстрый старт

## Выбор версии

У вас есть две версии бота:

### 1️⃣ Telegraf (оригинальная версия)
```bash
npm run start:telegraf:dev
```

### 2️⃣ grammY (новая версия)
```bash
npm run start:grammy:dev
```

## Установка

```bash
# 1. Установите зависимости
npm install

# 2. Создайте .env файл
cp .env.example .env  # если есть .env.example
# или создайте .env вручную

# 3. Настройте переменные окружения
# BOT_TOKEN=your_telegram_bot_token
# ADMIN_CHAT_ID=your_telegram_chat_id
# DATABASE_URL=file:./src/prisma/dev.db
# и т.д.

# 4. Примените миграции БД
npm run prisma:migrate

# 5. Запустите нужную версию
npm run start:telegraf:dev   # или
npm run start:grammy:dev
```

## Все доступные команды

### Telegraf
```bash
npm run start:telegraf:dev          # Development режим
npm run start:telegraf:prod         # Production режим
npm run start:migrate:telegraf:prod # Production с миграциями
```

### grammY
```bash
npm run start:grammy:dev            # Development режим
npm run start:grammy:prod           # Production режим
npm run start:migrate:grammy:prod   # Production с миграциями
```

### Общие команды
```bash
npm run build                       # Сборка проекта
npm run lint                        # Проверка кода
npm run test                        # Запуск тестов
npm run prisma:migrate             # Миграции БД
npm run prisma:studio              # Prisma Studio (GUI для БД)
```

## Структура проекта

```
src/
├── telegraf/          # Telegraf версия
├── grammy/            # grammY версия
├── prisma/            # База данных (общая)
├── payment/           # Оплата (общая)
├── user/              # Пользователи (общая)
├── tariff/            # Тарифы (общая)
├── outline/           # VPN (общая)
├── main-telegraf.ts   # Entry point для Telegraf
└── main-grammy.ts     # Entry point для grammY
```

## Переменные окружения (.env)

```bash
# Telegram Bot
BOT_TOKEN=your_bot_token_here
ADMIN_CHAT_ID=your_chat_id
ADMIN_CHAT_ID_2=optional_second_admin

# Database
DATABASE_URL=file:./src/prisma/dev.db

# Server
PORT=80
NODE_ENV=development

# Outline VPN
OUTLINE_API_URL=https://your-outline-server/api
DOMAIN=your-domain.com

# Payment
YOOMONEY_SECRET=your_yoomoney_secret
MINIMUM_BALANCE=3
```

## Полезные ссылки

- [PROJECT-STRUCTURE.md](../PROJECT-STRUCTURE.md) - Полная структура проекта
- [SWITCHING-VERSIONS.md](SWITCHING-VERSIONS.md) - Детальное руководство по переключению
- [MIGRATION-SUMMARY.md](MIGRATION-SUMMARY.md) - Сводка миграции Telegraf → grammY
- [CLAUDE.md](CLAUDE.md) - Инструкции для разработки

## Разница между версиями

| Telegraf | grammY |
|----------|--------|
| Декораторы `@Scene()` | Conversations (функции) |
| `ctx.scene.enter()` | `ctx.conversation.enter()` |
| `Markup.button.callback()` | `{text, callback_data}` |
| Старая, стабильная | Новая, современная |

## Какую версию выбрать?

- **Telegraf** - если нужна стабильность и проверенное решение
- **grammY** - если хотите современный API и новые возможности

Обе версии имеют **идентичную бизнес-логику** и работают с одной БД.

## Проблемы?

1. **Ошибка компиляции**: `npm install` для установки зависимостей
2. **БД не найдена**: `npm run prisma:migrate` для создания БД
3. **Порт занят**: измените `PORT` в `.env`
4. **Бот не отвечает**: проверьте `BOT_TOKEN` в `.env`

---

**Готово!** Выберите версию и запустите: `npm run start:telegraf:dev` или `npm run start:grammy:dev` 🎉
