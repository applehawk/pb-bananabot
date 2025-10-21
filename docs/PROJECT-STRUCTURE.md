# Структура проекта BananaBot

## Обзор

BananaBot - это минимальная база для Telegram бота на NestJS + grammY с платёжной системой YooMoney.

## Архитектура

```
src/
├── grammy/                        # grammY bot implementation
│   ├── bot.module.ts             # Главный модуль приложения
│   ├── bot.service.ts            # Высокоуровневые операции бота
│   ├── bot.update.ts             # Обработчики команд и сообщений
│   ├── grammy.module.ts          # Core grammY модуль
│   ├── grammy.service.ts         # Управление жизненным циклом бота
│   ├── grammy-context.interface.ts # Расширенный контекст
│   ├── webhook.controller.ts     # Webhook endpoint для production
│   ├── constants/
│   │   ├── buttons.const.ts      # Определения кнопок
│   │   └── scenes.const.ts       # Конфигурация сцен
│   └── conversations/             # Conversation handlers (9 файлов)
│       ├── conversations-registry.service.ts  # Регистрация conversations
│       ├── start.conversation.ts              # Приветствие
│       ├── home.conversation.ts               # Главное меню
│       ├── status.conversation.ts             # Статус пользователя
│       ├── question.conversation.ts           # Помощь
│       ├── get-access.conversation.ts         # Выбор тарифа
│       ├── payment.conversation.ts            # Оплата
│       ├── month-tariff.conversation.ts       # Тариф 1 месяц
│       ├── threemonth-tariff.conversation.ts  # Тариф 3 месяца
│       └── sixmonth-tariff.conversation.ts    # Тариф 6 месяцев
│
├── payment/                      # Платёжная система
│   ├── payment.module.ts
│   ├── payment.service.ts        # Основной сервис платежей
│   ├── payment.controller.ts     # Webhook controller
│   ├── payment.scheduler.ts      # Cron jobs (проверка, списание)
│   ├── strategies/               # Strategy Pattern
│   │   ├── payment-strategy.interface.ts
│   │   ├── yoomoney-payment.strategy.ts
│   │   └── factory/
│   │       └── payment-strategy.factory.ts
│   └── enum/
│       ├── payment-status.enum.ts       # PENDING, PAID, FAILED, CANCELED
│       ├── payment-system.enum.ts       # YOOMONEY
│       ├── balancechange-type.enum.ts   # PAYMENT, MANUALLY, SCHEDULER
│       └── balancechange-status.enum.ts # DONE, INSUFFICIENT
│
├── user/                         # Управление пользователями
│   ├── user.module.ts
│   └── user.service.ts           # CRUD + баланс
│
├── tariff/                       # Управление тарифами
│   ├── tariff.module.ts
│   └── tariff.service.ts         # CRUD тарифов
│
├── prisma/                       # База данных (Prisma ORM + SQLite)
│   ├── schema.prisma             # Схема БД
│   ├── prisma.module.ts
│   ├── prisma.service.ts
│   ├── migrations/               # Миграции
│   └── dev.db                    # SQLite база (не коммитится)
│
├── utils/                        # Утилиты
│   └── split-array-into-pairs.ts # Разбивка массива на пары
│
├── interceptors/                 # NestJS Interceptors
│   └── response-time-interceptor.service.ts
│
├── enum/                         # Общие enums
│   └── command.enum.ts           # Команды бота
│
└── main-grammy.ts               # Точка входа приложения
```

## Модули и их назначение

### 1. GrammY Module (Bot Core)

**Файлы:**
- `grammy/bot.module.ts` - Главный модуль приложения
- `grammy/grammy.module.ts` - Core grammY модуль
- `grammy/grammy.service.ts` - Управление ботом

**Ответственность:**
- Инициализация и настройка grammY бота
- Регистрация middleware (session, hydrate, conversations)
- Управление жизненным циклом (polling/webhook)
- Graceful shutdown

**Middleware stack:**
```
Session → Hydrate → Conversations → Service Injection
```

### 2. Bot Module

**Файлы:**
- `grammy/bot.service.ts` - Высокоуровневые операции
- `grammy/bot.update.ts` - Обработчики команд

**Ответственность:**
- Регистрация команд (`/start`, `/tariff`, `/up`, `/setmenu`)
- Обработка callback queries
- Отправка уведомлений
- Управление пользователями

### 3. Conversations

**Папка:** `grammy/conversations/`

**Ответственность:**
- Диалоговые сценарии с пользователями
- Навигация между сценами
- Ожидание ввода пользователя
- Интеграция с сервисами через context

**Структура conversation:**
```typescript
export async function myConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext
) {
  // Логика диалога
  await ctx.reply('Привет!');
  const response = await conversation.waitForCallbackQuery();
  // ...
}
```

### 4. Payment Module

**Файлы:**
- `payment/payment.service.ts` - Создание и валидация платежей
- `payment/payment.scheduler.ts` - Cron jobs
- `payment/strategies/` - Strategy Pattern для платёжных систем

**Ответственность:**
- Создание платежей
- Проверка статуса платежей (каждые 10 секунд)
- Webhook от YooMoney
- Автоматическое списание (каждую полночь)

**Strategy Pattern:**
```
PaymentService → PaymentStrategyFactory → YooMoneyPaymentStrategy
```

### 5. User Module

**Файлы:**
- `user/user.service.ts`

**Ответственность:**
- CRUD операции с пользователями
- Управление балансом
- История изменений баланса (BalanceChange)
- Поиск пользователей

**Основные методы:**
- `findOneByUserId()` - Получить пользователя по Telegram ID
- `findUserByUsername()` - Поиск по username
- `usersWithBalance()` - Пользователи с балансом >= X
- `commitBalanceChange()` - Изменение баланса с аудитом
- `upsert()` - Создать или обновить пользователя

### 6. Tariff Module

**Файлы:**
- `tariff/tariff.service.ts`

**Ответственность:**
- CRUD операций с тарифами
- Получение списка тарифов
- Обновление цен

**Методы:**
- `getOneById()` - Получить тариф по ID
- `getOneByName()` - Получить тариф по имени
- `getAllTariffs()` - Список всех тарифов (сортировка по цене)
- `updateTariffPrice()` - Обновить цену тарифа

### 7. Prisma Module

**Файлы:**
- `prisma/schema.prisma` - Схема базы данных
- `prisma/prisma.service.ts` - Prisma Client

**Модели:**

#### User
```prisma
model User {
  userId      Int      @id
  chatId      Int?
  firstname   String?
  lastname    String?
  username    String?
  balance     Int
  createdAt   DateTime @default(now())
}
```

#### Payment
```prisma
model Payment {
  paymentId       String   @id
  orderId         String
  status          String   @default("PENDING")
  paymentSystem   String   @default("YOOMONEY")
  userId          Int
  chatId          Int
  tariffId        String
  amount          Int
  paymentAt       DateTime
  paymentAmount   Int
  paymentCurrency String
  url             String
  form            String
  transactionId   String?
  isFinal         Boolean?
  email           String?
}
```

#### Tariff
```prisma
model Tariff {
  id       String @id @unique
  name     String
  price    Int
  period   Int
  caption  String
  @@index([price])
}
```

#### BalanceChange
```prisma
model BalanceChange {
  id           Int      @id @default(autoincrement())
  userId       Int
  paymentId    String?
  balance      Int      # Баланс ДО изменения
  changeAmount Int      # Сумма изменения
  type         String   # PAYMENT, MANUALLY, SCHEDULER
  status       String   # DONE, INSUFFICIENT
  changeAt     DateTime @default(now())
}
```

## Потоки данных

### 1. Регистрация пользователя

```
User → /start → BotUpdate.handleStart()
              → BotService.upsertUser()
              → UserService.upsert()
              → Prisma.user.upsert()
```

### 2. Пополнение баланса

```
User → GET_ACCESS conversation
     → Выбор тарифа (MONTH_TARIFF)
     → PAYMENT conversation
     → PaymentService.createPayment()
     → YooMoneyStrategy.createPayment()
     → Prisma.payment.create() (status: PENDING)
     → Отправка ссылки пользователю

PaymentScheduler (каждые 10 сек)
     → PaymentService.validatePayment()
     → YooMoneyStrategy.validateTransaction()
     → UserService.commitBalanceChange() (если статус изменился)
     → Prisma.balanceChange.create()
     → Prisma.user.update() (balance)
     → Уведомления пользователю и админу
```

### 3. Списание баланса

```
PaymentScheduler (каждую полночь)
     → UserService.usersWithBalance(MINIMUM_BALANCE)
     → UserService.commitBalanceChange() (для каждого)
     → Prisma.balanceChange.create()
     → Prisma.user.update() (balance - MINIMUM_BALANCE)
     → Уведомление при недостатке средств
```

## Dependency Injection

### Module Graph

```
BotModule (root)
  ├── ConfigModule (global)
  ├── ScheduleModule (global)
  ├── GrammYModule
  │   └── BotService
  ├── PaymentModule
  │   ├── PaymentService
  │   ├── PaymentScheduler
  │   └── YooMoneyClientModule
  ├── UserModule
  │   └── UserService
  ├── TariffModule
  │   └── TariffService
  └── PrismaModule
      └── PrismaService
```

### Service Injection в Context

```typescript
// conversations-registry.service.ts
private injectServicesIntoContext(bot: Bot<MyContext>) {
  bot.use(async (ctx, next) => {
    (ctx as any).botService = this.botService;
    (ctx as any).userService = this.userService;
    (ctx as any).paymentService = this.paymentService;
    (ctx as any).tariffService = this.tariffService;
    await next();
  });
}
```

## Extended Context

```typescript
type MyContext = Context & ConversationFlavor & {
  session: SessionData;           // messageId, tariffId
  botService: BotService;
  userService: UserService;
  paymentService: PaymentService;
  tariffService: TariffService;
};
```

## Команды запуска

```bash
# Development (polling mode)
npm run start:dev

# Production (webhook mode)
npm run build:grammy
npm run start:prod

# Production с миграциями
npm run start:migrate:prod

# Установка webhook
npm run webhook:set
```

## Управление БД

```bash
# Prisma Studio (GUI)
npm run prisma:studio

# Создать миграцию
npm run prisma:migrate

# Применить миграции
npm run prisma:migrate:deploy

# Сгенерировать Prisma Client
npm run prisma:generate
```

## Переменные окружения

```env
# Telegram
BOT_TOKEN=your_bot_token
ADMIN_CHAT_ID=123456789
ADMIN_CHAT_ID_2=987654321
TELEGRAM_SECRET_TOKEN=webhook_secret

# Database
DATABASE_URL=file:./src/prisma/dev.db

# Server
PORT=80
NODE_ENV=development
DOMAIN=https://your-domain.com

# Payment
YOOMONEY_SECRET=yoomoney_webhook_secret
YOOMONEY_SUCCESS_URL=https://your-domain.com/payment/success
MINIMUM_BALANCE=3
```

## Паттерны и Best Practices

### 1. Strategy Pattern
Используется для платёжных систем - легко добавить новую платёжную систему:
```typescript
class StripePaymentStrategy implements PaymentStrategy {
  async createPayment(data: CreatePaymentData) { /* ... */ }
  async validateTransaction(paymentId: string) { /* ... */ }
}
```

### 2. Dependency Injection
Все зависимости инжектируются через конструктор:
```typescript
constructor(
  private readonly userService: UserService,
  private readonly paymentService: PaymentService,
) {}
```

### 3. Audit Trail
Все изменения баланса сохраняются в `BalanceChange`:
```typescript
{
  userId: 123,
  balance: 100,        // Баланс ДО изменения
  changeAmount: 50,    // +50 (пополнение) или -3 (списание)
  type: 'PAYMENT',     // PAYMENT | MANUALLY | SCHEDULER
  status: 'DONE',      // DONE | INSUFFICIENT
}
```

### 4. Idempotency
Защита от двойного зачисления:
```typescript
if (paymentStatus !== payment.status) {
  // Зачисляем ТОЛЬКО при изменении статуса
  await commitBalanceChange(...);
}
```

## Расширение функциональности

### Добавить новую conversation

1. Создать файл: `src/grammy/conversations/my-feature.conversation.ts`
2. Зарегистрировать в `conversations-registry.service.ts`
3. Добавить кнопку в `constants/buttons.const.ts`
4. Добавить обработчик в `bot.update.ts`

### Добавить новую платёжную систему

1. Создать strategy: `src/payment/strategies/stripe-payment.strategy.ts`
2. Реализовать interface `PaymentStrategy`
3. Добавить в enum `PaymentSystemEnum.STRIPE`
4. Добавить в factory: `PaymentStrategyFactory.createPaymentStrategy()`

### Добавить новый модуль

1. Создать модуль: `nest g module my-feature`
2. Создать сервис: `nest g service my-feature`
3. Импортировать в `BotModule`
4. Инжектировать в context (если нужен в conversations)

## Структура файлов (полная)

```
bananabot_rewriting_vpnssconf/
├── src/
│   ├── grammy/                        # 🤖 Bot implementation
│   ├── payment/                       # 💳 Payment system
│   ├── user/                          # 👤 User management
│   ├── tariff/                        # 📊 Tariff management
│   ├── prisma/                        # 🗄️ Database
│   ├── utils/                         # 🛠️ Utilities
│   ├── interceptors/                  # 🔍 Interceptors
│   ├── enum/                          # 📝 Enums
│   └── main-grammy.ts                 # 🚀 Entry point
│
├── libs/
│   └── yoomoney-client/               # YooMoney SDK wrapper
│
├── docs/
│   ├── README-GRAMMY.md               # Основная документация
│   ├── PAYMENT-WORKFLOW.md            # Логика платежей
│   ├── PROJECT-STRUCTURE.md           # Этот файл
│   └── QUICK-START.md                 # Быстрый старт
│
├── scripts/
│   └── set-webhook.ts                 # Настройка webhook
│
├── .env.example                       # Пример переменных окружения
├── package.json
├── tsconfig.json
├── nest-cli.json
└── README.md                          # Главный README
```

## Итоги

Проект построен на современном стеке:
- **NestJS** - модульная архитектура, DI
- **grammY** - современный фреймворк для Telegram Bot API
- **Prisma** - типобезопасный ORM
- **SQLite** - простая встроенная БД
- **TypeScript** - полная типизация

Готов к расширению и production использованию!
