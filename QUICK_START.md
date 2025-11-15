# Quick Start Guide - AI Image Generation Bot

## Что уже создано:

### ✅ База данных (Prisma)
- Полная схема для PostgreSQL
- Модели: User, UserSettings, Generation, InputImage, Transaction, Referral, DailyBonus, CreditPackage, Analytics, PromoCode
- Все enum типы и индексы

### ✅ Конфигурация
- .env.example с полным набором переменных
- configuration.ts - загрузка конфигурации
- validation.schema.ts - валидация с Joi

### ✅ Core Services
- **DatabaseModule** - Prisma интеграция
- **UserService** - управление пользователями, кредитами, настройками
- **CreditsService** - начисление/списание кредитов, бонусы, транзакции
- **GeminiService** - интеграция с Gemini AI для генерации изображений

## Что нужно доделать:

### 1. Generation Service (2-3 hours)
```typescript
// src/generation/generation.service.ts
- orchestrate весь процесс генерации
- вызов GeminiService
- сохранение результатов в БД
- обработка ошибок и рефанды

// src/generation/storage/image-storage.service.ts
- загрузка в S3/R2
- получение публичных URL
```

### 2. Telegram Bot Core (3-4 hours)
```typescript
// src/telegram/telegram.service.ts
- аналог grammy.service.ts
- инициализация бота
- регистрация handlers

// src/telegram/bot.provider.ts
- создание Grammy Bot instance
- настройка middleware
- conversations plugin

// src/telegram/telegram-context.interface.ts
- расширение Context с сервисами
- SessionData для генерации
```

### 3. Bot Commands (2-3 hours)
```typescript
// Реализовать команды:
- /start - регистрация + реферал
- /generate - быстрая генерация
- /balance - показать кредиты
- /settings - настройки генерации
- /buy - покупка кредитов
- /history - история генераций
- /help - справка
```

### 4. Handlers (2 hours)
```typescript
// Text handler - обработка промптов
// Photo handler - image-to-image
// Callback handler - inline кнопки
```

### 5. Payment Integration (2-3 hours)
Адаптировать существующую систему:
- Обновить под новую Prisma схему
- Добавить Telegram Stars strategy
- Добавить Crypto strategy

### 6. Docker (1 hour)
```yaml
# docker-compose.yml
- app (Node.js)
- postgres
- redis (optional)
```

## Установка и запуск:

### Шаг 1: Установить зависимости
```bash
npm install
```

### Шаг 2: Настроить .env
```bash
cp .env.example .env
# Заполнить все необходимые ключи
```

### Шаг 3: Запустить БД
```bash
# Локально PostgreSQL или через Docker
docker run -d \
  --name postgres \
  -e POSTGRES_USER=user \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=image_gen_bot \
  -p 5432:5432 \
  postgres:16
```

### Шаг 4: Миграции
```bash
npm run prisma:generate
npm run prisma:migrate
```

### Шаг 5: Запуск
```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## Структура проекта:

```
src/
├── config/               ✅ DONE
│   ├── configuration.ts
│   └── validation.schema.ts
├── database/             ✅ DONE
│   ├── prisma.service.ts
│   └── database.module.ts
├── user/                 ✅ DONE
│   ├── user.service.ts
│   └── user.module.ts
├── credits/              ✅ DONE
│   ├── credits.service.ts
│   └── credits.module.ts
├── gemini/               ✅ DONE
│   ├── gemini.service.ts
│   ├── utils/
│   │   └── prompt-enhancer.util.ts
│   └── gemini.module.ts
├── generation/           ⚠️ TODO
│   ├── generation.service.ts
│   ├── storage/
│   │   └── image-storage.service.ts
│   └── generation.module.ts
├── telegram/             ⚠️ TODO
│   ├── telegram.service.ts
│   ├── bot.provider.ts
│   ├── commands/
│   ├── handlers/
│   ├── conversations/
│   └── telegram.module.ts
├── payment/              ⚠️ ADAPT EXISTING
│   └── ... (уже есть, нужно адаптировать)
├── referral/             ⚠️ TODO
│   ├── referral.service.ts
│   └── referral.module.ts
├── app.module.ts         ⚠️ TODO
└── main.ts               ⚠️ TODO
```

## Приоритеты:

### ВЫСОКИЙ (для MVP):
1. ✅ Database & User Management  
2. ✅ Credits System
3. ✅ Gemini Integration
4. ⚠️ Generation Orchestration
5. ⚠️ Telegram Bot Core
6. ⚠️ Basic Commands (/start, /generate, /balance)
7. ⚠️ Text-to-Image Handler

### СРЕДНИЙ:
- Image-to-Image
- Payment Integration
- History Command
- Settings

### НИЗКИЙ:
- Conversations
- Referral System
- Analytics
- Admin Panel

## Полезные команды:

```bash
# Генерация Prisma Client
npm run prisma:generate

# Создать миграцию
npm run prisma:migrate

# Prisma Studio (GUI для БД)
npm run prisma:studio

# Установить webhook
npm run webhook:set

# Запуск тестов
npm test

# Линтинг
npm run lint
```

## Следующие шаги:

1. Завершить Generation Service
2. Создать Telegram Bot Core
3. Реализовать основные команды
4. Протестировать text-to-image генерацию
5. Добавить платежи
6. Деплой

## Примечания:

- Используется существующая архитектура Grammy из src/grammy/
- Паттерн Strategy для платежей уже реализован
- Prisma схема готова для production
- Все сервисы полностью типизированы

## Готовые API методы:

### UserService
- `findByTelegramId(telegramId)` - найти пользователя
- `upsert(data)` - создать/обновить
- `updateCredits(userId, amount)` - изменить кредиты
- `deductCredits(userId, amount)` - списать кредиты
- `getSettings(userId)` - получить настройки
- `getStatistics(userId)` - статистика

### CreditsService
- `calculateCost(type, numImages, batchSize)` - рассчитать стоимость
- `addCredits(userId, amount, type)` - добавить кредиты
- `deductCredits(userId, amount, genId)` - списать
- `refundCredits(userId, amount, reason)` - возврат
- `grantReferralBonus(referrerId, referredId)` - реферальный бонус
- `claimDailyBonus(userId)` - ежедневный бонус

### GeminiService
- `enhancePrompt(prompt)` - улучшить промпт
- `generateFromText(params)` - text-to-image
- `generateFromImage(params)` - image-to-image
- `generateBatch(params)` - batch генерация
- `healthCheck()` - проверка работы API

