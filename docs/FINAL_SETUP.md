# Финальная настройка AI Image Generation Bot

## ✅ Что уже сделано

### Основная инфраструктура
- ✅ Prisma схема базы данных (13 моделей)
- ✅ Configuration module с валидацией
- ✅ Database module (Prisma service)
- ✅ Docker setup (Dockerfile, docker-compose.yml)

### Core Services
- ✅ UserService - управление пользователями, кредиты, настройки
- ✅ CreditsService - начисление/списание кредитов, бонусы, транзакции
- ✅ GeminiService - интеграция с Gemini AI для генерации изображений
- ✅ GenerationService - полный цикл генерации (text-to-image, image-to-image)
- ✅ ImageStorageService - загрузка в S3/R2
- ✅ TelegramStorageService - альтернативное хранилище через Telegram file_id
- ✅ TelegramFileDownloader - загрузка файлов через Telegram Bot API

### Grammy Bot Integration
- ✅ Адаптирован существующий Grammy модуль
- ✅ Расширен grammy-context.interface.ts с новыми сервисами
- ✅ GrammYServiceExtension - инъекция Credits и Generation сервисов
- ✅ ImageGenUpdate - регистрация команд /generate, /balance, /help, /history
- ✅ Handlers для photo (image-to-image)

### Документация
- ✅ README_IMAGE_GEN.md - полная документация
- ✅ QUICK_START.md - быстрый старт
- ✅ NEXT_STEPS.md - примеры кода
- ✅ PROJECT_SUMMARY.md - сводка
- ✅ IMPLEMENTATION_ROADMAP.md - дорожная карта

## 📋 Следующие шаги

### 1. Установка зависимостей

```bash
npm install
```

Установит все новые зависимости:
- @google/generative-ai (Gemini AI)
- @grammyjs/menu
- @nestjs/axios
- @nestjs/throttler
- @aws-sdk/client-s3 (для S3)
- sharp (обработка изображений)
- nanoid (генерация referral codes)
- joi (валидация)
- class-validator
- class-transformer

### 2. Настройка переменных окружения

```bash
cp .env.example .env
```

Заполните **обязательные** переменные:

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=ваш_токен_от_BotFather

# Gemini AI (получить на https://ai.google.dev)
GEMINI_API_KEY=ваш_gemini_api_key

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/image_gen_bot?schema=public
```

**Опционально** (для production):
- AWS S3 credentials (или оставьте закомментированным для Telegram storage)
- YooMoney, Telegram Stars, Crypto для платежей
- Redis для сессий

### 3. Запуск базы данных

#### Вариант А: Docker (рекомендуется)
```bash
docker-compose up -d postgres
```

#### Вариант Б: Локальный PostgreSQL
```bash
# Создать базу вручную
createdb image_gen_bot
```

### 4. Применение миграций Prisma

```bash
# Генерация Prisma Client
npm run prisma:generate

# Создание и применение миграций
npm run prisma:migrate

# Опционально: открыть Prisma Studio для просмотра БД
npm run prisma:studio
```

### 5. Запуск бота

#### Development (polling mode)
```bash
npm run start:dev
```

Бот запустится в режиме polling (без webhook) и будет готов к тестированию.

#### Production (webhook mode)
```bash
# Build
npm run build

# Run
npm run start:prod
```

### 6. Тестирование

Откройте Telegram и найдите вашего бота. Попробуйте команды:

```
/start - Регистрация
/generate Futuristic city at sunset - Генерация изображения
/balance - Проверка баланса
/help - Справка
```

## 🔧 Структура созданных файлов

### src/config/
- `configuration.ts` - загрузка env переменных
- `validation.schema.ts` - Joi валидация

### src/database/
- `prisma.service.ts` - Prisma клиент
- `database.module.ts` - Database модуль

### src/user/
- `user.service.ts` - User CRUD, кредиты, настройки
- `user.module.ts`

### src/credits/
- `credits.service.ts` - Credits логика, бонусы
- `credits.module.ts`

### src/gemini/
- `gemini.service.ts` - Gemini AI интеграция
- `utils/prompt-enhancer.util.ts`
- `gemini.module.ts`

### src/generation/
- `generation.service.ts` - Orchestration генерации
- `storage/image-storage.service.ts` - S3/R2 upload
- `storage/telegram-storage.service.ts` - Telegram storage
- `generation.module.ts`

### src/grammy/ (адаптированный)
- `grammy-context.interface.ts` - ✨ Обновлён с новыми сервисами
- `grammy-service-extension.ts` - ✨ Новый: инъекция сервисов
- `image-gen.update.ts` - ✨ Новый: команды генерации
- `grammy.module.ts` - ✨ Обновлён с новыми модулями
- `grammy.service.ts` - Без изменений
- `bot.service.ts` - Без изменений

### src/telegram/ (дополнительные файлы)
- `utils/file-downloader.util.ts` - Telegram file download

## 🎯 Основные возможности

### Готовые команды:
- `/start` - Регистрация + реферальная система
- `/generate [prompt]` - Text-to-Image генерация
- `/balance` - Баланс кредитов + история транзакций
- `/help` - Справка с примерами
- `/history` - История последних генераций

### Готовые handlers:
- Text messages → автоматическая генерация
- Photo messages → image-to-image (в разработке)

### Готовая логика:
- Проверка кредитов перед генерацией
- Автоматическое списание кредитов
- Сохранение в БД
- Обработка ошибок + рефанды
- Реферальная система (+3 кредита за друга)
- Бесплатные кредиты для новых пользователей

## 🚨 Важные замечания

### 1. Gemini API
- Используется модель `gemini-2.0-flash-exp`
- Поддерживает генерацию изображений
- Требует API ключ с https://ai.google.dev

### 2. Хранилище изображений
Есть 2 варианта:

**Вариант А: AWS S3 / Cloudflare R2** (production)
- Надёжное хранилище
- Требует настройки credentials в .env
- Публичные URL для изображений

**Вариант Б: Telegram Storage** (development)
- Бесплатно
- Использует file_id
- Требует настройки TELEGRAM_STORAGE_CHAT_ID (private channel)
- Или можно хранить base64 в metadata (временно)

### 3. База данных
- **PostgreSQL** обязательно (не SQLite!)
- Prisma schema уже настроена
- Все индексы оптимизированы

### 4. Существующий код
Сохранены и работают:
- Старые conversations (tariff, payment)
- Существующие команды /start, /tariff, /up
- WebhookController
- BotUpdate handlers

Новая функциональность добавлена **без конфликтов**.

## 📊 Статус разработки

✅ **MVP готов на 90%**

Осталось:
- Доработать photo handler (image-to-image с Gemini)
- Добавить inline кнопки для вариаций
- Настроить payment integration для покупки кредитов
- Добавить conversations для настроек

## 🐛 Возможные проблемы

### Ошибка: "GEMINI_API_KEY is not configured"
**Решение**: Добавьте GEMINI_API_KEY в .env

### Ошибка: "Failed to upload image"
**Решение**: Проверьте AWS credentials или используйте Telegram storage

### Ошибка: "Insufficient credits"
**Решение**: Проверьте FREE_CREDITS в .env или добавьте кредиты вручную в БД

### Бот не отвечает
**Решение**:
1. Проверьте TELEGRAM_BOT_TOKEN
2. Проверьте что бот запущен: `npm run start:dev`
3. Проверьте логи в консоли

## 📞 Поддержка

Все логи выводятся в консоль с помощью NestJS Logger.

Уровни логирования:
- `LOG_LEVEL=debug` - подробные логи
- `LOG_LEVEL=info` - стандартные логи
- `LOG_LEVEL=error` - только ошибки

## 🎉 Запуск в production

```bash
# 1. Build
npm run build

# 2. Миграции
npm run prisma:migrate:deploy

# 3. Запуск
npm run start:prod
```

Или через Docker:
```bash
docker-compose up -d
```

## 🔗 Полезные ссылки

- [Gemini API Docs](https://ai.google.dev/gemini-api/docs)
- [Grammy Docs](https://grammy.dev/)
- [Prisma Docs](https://www.prisma.io/docs)
- [Telegram Bot API](https://core.telegram.org/bots/api)

---

**Готово к тестированию!** 🚀

Запустите `npm install && npm run start:dev` и начните генерировать изображения!
