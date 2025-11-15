# AI Image Generation Telegram Bot

Полнофункциональный Telegram бот для генерации изображений с использованием Gemini 2.5 Flash Image API.

## Стек технологий

- **Backend**: NestJS + TypeScript
- **Bot Framework**: GrammY (Bot API v9.2)
- **AI Engine**: Google Gemini 2.5 Flash Image  
- **Database**: PostgreSQL + Prisma ORM
- **Payment Systems**: YooMoney, Telegram Stars, Crypto
- **Storage**: AWS S3 / Cloudflare R2
- **Containerization**: Docker + Docker Compose

## Основные возможности

### Генерация изображений
- **Text-to-Image** - создание изображений по текстовому описанию
- **Image-to-Image** - редактирование и трансформация загруженных изображений
- **Multi-Image** - работа с несколькими входными изображениями (до 16)
- **Batch Generation** - генерация до 4 вариантов изображения за раз
- **Различные соотношения сторон**: 1:1, 16:9, 9:16, 3:4, 4:3
- **Настраиваемые safety filters** для контроля контента

### Монетизация
- **Кредитная система**:
  - Text-to-Image: 1 кредит
  - Image-to-Image: 1.5 кредита  
  - Multi-Image (2-4 фото): 2 кредита
  - Multi-Image (5-16 фото): 3 кредита
  - Batch (4 варианта): ×4 от базовой цены
- **Бесплатные кредиты**: 3 изображения для новых пользователей
- **Платежные системы**: YooMoney, Telegram Stars, Криптовалюта

### Бонусная система
- **Реферальная программа**: +3 кредита за приглашенного друга
- **Ежедневные бонусы**:
  - День 1: +0.5 кредита
  - День 3: +1 кредит
  - День 7: +2 кредита
  - День 30: +5 кредитов
- **Бонус за первую покупку реферала**: +5 кредитов рефереру

## Команды бота

```
/start - Приветствие и регистрация пользователя
/generate [prompt] - Быстрая генерация изображения
/settings - Настройка параметров генерации
/balance - Проверка баланса кредитов
/buy - Покупка кредитов (пакеты)
/history - История последних 20 генераций
/help - Справка и примеры использования
/cancel - Отмена текущей операции
```

## Архитектура проекта

```
src/
├── config/                   # Конфигурация приложения
│   ├── configuration.ts      # Загрузка переменных окружения
│   └── validation.schema.ts  # Joi валидация
├── database/                 # База данных
│   ├── prisma.service.ts     # Prisma клиент
│   └── database.module.ts    
├── user/                     # Управление пользователями
│   ├── user.service.ts       # CRUD, кредиты, настройки
│   └── user.module.ts
├── credits/                  # Система кредитов
│   ├── credits.service.ts    # Начисление/списание, бонусы
│   └── credits.module.ts
├── gemini/                   # Gemini AI интеграция
│   ├── gemini.service.ts     # Генерация изображений
│   ├── utils/
│   │   └── prompt-enhancer.util.ts
│   └── gemini.module.ts
├── generation/               # Оркестрация генерации
│   ├── generation.service.ts # Полный цикл генерации
│   ├── storage/
│   │   └── image-storage.service.ts  # S3/R2 upload
│   └── generation.module.ts
├── telegram/                 # Telegram бот
│   ├── telegram.service.ts   # Grammy сервис
│   ├── bot.provider.ts       # Bot instance
│   ├── commands/             # Команды бота
│   ├── handlers/             # Обработчики сообщений
│   ├── conversations/        # Интерактивные диалоги
│   ├── middlewares/          # Auth, rate-limit, logging
│   └── telegram.module.ts
├── payment/                  # Платежная система
│   ├── payment.service.ts
│   ├── providers/
│   │   ├── yoomoney.provider.ts
│   │   ├── telegram-stars.provider.ts
│   │   └── crypto.provider.ts
│   └── webhooks/
├── referral/                 # Реферальная программа
│   ├── referral.service.ts
│   └── referral.module.ts
├── app.module.ts             # Root module
└── main.ts                   # Entry point
```

## Установка

### 1. Клонирование и зависимости

```bash
git clone <repository>
cd bananabot
npm install
```

### 2. Настройка переменных окружения

```bash
cp .env.example .env
```

Заполните обязательные переменные:
- `TELEGRAM_BOT_TOKEN` - токен бота от @BotFather
- `GEMINI_API_KEY` - ключ Google Gemini API
- `DATABASE_URL` - PostgreSQL connection string
- Платежные системы (опционально)
- Storage credentials (S3 или R2)

### 3. Запуск базы данных

#### Вариант 1: Docker
```bash
docker run -d \
  --name postgres \
  -e POSTGRES_USER=user \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=image_gen_bot \
  -p 5432:5432 \
  postgres:16
```

#### Вариант 2: Локальный PostgreSQL
```bash
# Создать базу данных вручную
createdb image_gen_bot
```

### 4. Миграции Prisma

```bash
# Генерация Prisma Client
npm run prisma:generate

# Применение миграций
npm run prisma:migrate

# Открыть Prisma Studio (опционально)
npm run prisma:studio
```

### 5. Запуск приложения

#### Development
```bash
npm run start:dev
```

#### Production
```bash
npm run build
npm run start:prod
```

## Docker Compose (рекомендуется)

```bash
# Запуск всех сервисов
docker-compose up -d

# Логи
docker-compose logs -f

# Остановка
docker-compose down
```

## База данных (Prisma Schema)

### Основные модели

**User** - пользователи
- credits (баланс кредитов)
- totalGenerated (всего сгенерировано)
- referralCode (уникальный реферальный код)
- settings (настройки генерации)

**Generation** - история генераций
- type (TEXT_TO_IMAGE, IMAGE_TO_IMAGE, MULTI_IMAGE)
- prompt, enhancedPrompt
- imageUrl, fileId
- status, creditsUsed

**Transaction** - транзакции
- type (PURCHASE, BONUS, REFERRAL, DAILY_BONUS, GENERATION_COST)
- amount, creditsAdded
- paymentMethod, status

**Referral** - реферальная система
- referrerId, referredId
- bonusGranted, bonusAmount

**DailyBonus** - ежедневные бонусы
- streakDays (серия дней)
- lastClaimDate
- totalBonuses

## API Сервисов

### UserService
```typescript
// Найти пользователя по Telegram ID
findByTelegramId(telegramId: bigint): Promise<User>

// Создать или обновить пользователя
upsert(data): Promise<User>

// Изменить кредиты
updateCredits(userId: string, amount: number): Promise<User>

// Получить настройки
getSettings(userId: string): Promise<UserSettings>

// Статистика пользователя
getStatistics(userId: string): Promise<Statistics>
```

### CreditsService
```typescript
// Рассчитать стоимость генерации
calculateCost(type: string, numImages: number, batchSize: number): number

// Добавить кредиты
addCredits(userId, amount, type, paymentMethod): Promise<Transaction>

// Списать кредиты
deductCredits(userId, amount, generationId): Promise<Transaction>

// Вернуть кредиты
refundCredits(userId, amount, reason): Promise<Transaction>

// Реферальный бонус
grantReferralBonus(referrerId, referredId): Promise<void>

// Ежедневный бонус
claimDailyBonus(userId): Promise<{bonusAmount, streakDays}>
```

### GeminiService
```typescript
// Улучшить промпт с помощью AI
enhancePrompt(prompt: string): Promise<string>

// Text-to-Image генерация
generateFromText(params: GenerateImageParams): Promise<GenerationResult>

// Image-to-Image генерация
generateFromImage(params: GenerateImageParams): Promise<GenerationResult>

// Batch генерация
generateBatch(params: GenerateImageParams): Promise<GenerationResult>

// Проверка работоспособности
healthCheck(): Promise<boolean>
```

## Процесс генерации

### Text-to-Image
```
Пользователь отправляет: "Футуристический город на закате"
  ↓
Проверка кредитов (1 кредит)
  ↓
Статус: "🎨 Генерирую изображение... ⏱ 5-10 сек"
  ↓
Вызов Gemini API с параметрами из UserSettings
  ↓
Получение base64 изображения
  ↓
Загрузка на CDN/S3
  ↓
Отправка в Telegram + inline кнопки [🔄 Вариация] [⚙️ Параметры]
  ↓
Списание кредита + сохранение в БД
```

### Image-to-Image
```
Пользователь загружает фото + caption: "Сделай в стиле аниме"
  ↓
Скачивание изображения через Bot API
  ↓
Проверка кредитов (1.5 кредита)
  ↓
Конвертация в base64
  ↓
Отправка в Gemini API вместе с промптом
  ↓
Получение трансформированного изображения
  ↓
Отправка результата
```

## Пакеты кредитов

```
💎 10 кредитов  - $2.99  (скидка 0%)
💎 50 кредитов  - $12.99 (скидка 13%)
💎 150 кредитов - $34.99 (скидка 23%)
💎 500 кредитов - $99.99 (скидка 33%)
```

## Безопасность

- **Rate Limiting**: 10 запросов/минуту на пользователя
- **Content Moderation**: Gemini safety settings
- **SQL Injection Protection**: Prisma ORM
- **Валидация данных**: class-validator для DTO
- **Логирование**: Все транзакции и операции

## Мониторинг

- **Health Check**: `/health` endpoint
- **Логирование**: Winston/Pino
- **Sentry**: Интеграция для отслеживания ошибок (опционально)
- **Аналитика**: Ежедневная статистика в БД

## Тестирование

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov
```

## Деплой

### Production Checklist
- [ ] Настроить все переменные окружения
- [ ] Подключить production базу данных
- [ ] Применить миграции
- [ ] Настроить S3/R2 для хранения изображений
- [ ] Настроить платежные системы
- [ ] Установить webhook для Telegram
- [ ] Настроить HTTPS/SSL
- [ ] Настроить логирование
- [ ] Настроить мониторинг

### Webhook Setup
```bash
# Установить webhook
npm run webhook:set

# Или вручную:
curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
  -H "Content-Type: application/json" \
  -d '{"url": "https://yourdomain.com/webhook/telegram"}'
```

## Статус разработки

✅ **Завершено**:
- Prisma схема базы данных
- Конфигурация и валидация
- UserService (управление пользователями, кредиты)
- CreditsService (начисление/списание, бонусы)
- GeminiService (интеграция с Gemini AI)
- Payment архитектура (Strategy pattern)

⚠️ **В разработке**:
- GenerationService (оркестрация генерации)
- TelegramService (Grammy интеграция)
- Bot Commands (start, generate, balance, settings, buy, history)
- Handlers (text, photo, callback)
- Image Storage Service (S3/R2)
- Conversations (интерактивные диалоги)
- Referral Service

📋 **Планируется**:
- Docker контейнеризация
- Полная документация
- Unit & E2E тесты
- Admin панель
- Аналитика и статистика

## Лицензия

MIT

## Поддержка

Для вопросов и предложений создавайте Issues в GitHub.

---

Made with ❤️ using NestJS, GrammY, and Gemini AI
