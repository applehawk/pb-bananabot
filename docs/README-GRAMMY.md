# BananaBot - Telegram Bot с платежами

Минимальная база для Telegram бота на NestJS + grammY с интеграцией платёжной системы YooMoney.

## Что это?

Готовый к использованию шаблон Telegram бота со следующими возможностями:

- Автоматическая регистрация и запоминание пользователей
- Управление балансом пользователей
- Интеграция с платёжной системой YooMoney
- Автоматическое списание баланса по расписанию
- Проверка статуса баланса
- Админ-панель для управления

## Быстрый старт

### Требования

- Node.js >= 18.0.0
- npm >= 9.0.0
- Telegram Bot Token от [@BotFather](https://t.me/BotFather)
- YooMoney аккаунт (для приёма платежей)

### Установка

1. **Установите зависимости:**

```bash
npm install
```

2. **Настройте переменные окружения:**

Создайте файл `.env` в корне проекта:

```env
# Telegram Bot
BOT_TOKEN=your_bot_token_here
ADMIN_CHAT_ID=your_telegram_user_id
ADMIN_CHAT_ID_2=optional_second_admin_id

# Database
DATABASE_URL=file:./src/prisma/dev.db

# Server
DOMAIN=your-domain.com
PORT=80
NODE_ENV=development

# Payment (YooMoney)
YOOMONEY_SECRET=your_yoomoney_secret
YOOMONEY_SUCCESS_URL=https://your-domain.com/payment/success
MINIMUM_BALANCE=3

# Webhook (optional, для production)
TELEGRAM_SECRET_TOKEN=your_random_secret_token
```

3. **Инициализируйте базу данных:**

```bash
# Генерация Prisma client
npm run prisma:generate

# Применение миграций
npm run prisma:migrate
```

4. **Запустите бота:**

```bash
# Development (polling mode)
npm run start:dev

# Production (webhook mode)
npm run build:grammy
npm run start:prod
```

## Архитектура проекта

### Структура папок

```
src/
├── grammy/                        # grammY bot implementation
│   ├── bot.module.ts             # Главный модуль бота
│   ├── bot.service.ts            # Высокоуровневые операции бота
│   ├── bot.update.ts             # Обработчики команд и сообщений
│   ├── grammy.module.ts          # Core grammY модуль
│   ├── grammy.service.ts         # Управление жизненным циклом бота
│   ├── grammy-context.interface.ts # Расширенный контекст
│   ├── webhook.controller.ts     # Webhook endpoint
│   ├── constants/
│   │   ├── buttons.const.ts      # Определения кнопок
│   │   └── scenes.const.ts       # Конфигурация сцен
│   └── conversations/             # Conversation handlers
│       ├── conversations-registry.service.ts
│       ├── start.conversation.ts
│       ├── home.conversation.ts
│       ├── status.conversation.ts
│       ├── question.conversation.ts
│       ├── get-access.conversation.ts
│       ├── payment.conversation.ts
│       ├── month-tariff.conversation.ts
│       ├── threemonth-tariff.conversation.ts
│       └── sixmonth-tariff.conversation.ts
│
├── payment/                      # Платёжная система
│   ├── payment.module.ts
│   ├── payment.service.ts
│   ├── payment.controller.ts
│   ├── payment.scheduler.ts     # Cron jobs
│   ├── strategies/
│   │   ├── payment-strategy.interface.ts
│   │   ├── yoomoney-payment.strategy.ts
│   │   └── factory/
│   │       └── payment-strategy.factory.ts
│   └── enum/
│       ├── payment-status.enum.ts
│       ├── payment-system.enum.ts
│       ├── balancechange-type.enum.ts
│       └── balancechange-status.enum.ts
│
├── user/                         # Управление пользователями
│   ├── user.module.ts
│   └── user.service.ts
│
├── tariff/                       # Управление тарифами
│   ├── tariff.module.ts
│   └── tariff.service.ts
│
├── prisma/                       # База данных
│   ├── schema.prisma
│   ├── prisma.module.ts
│   └── prisma.service.ts
│
├── utils/                        # Утилиты
│   └── split-array-into-pairs.ts
│
└── main-grammy.ts               # Точка входа
```

## Основные возможности

### Для пользователей

#### 1. Автоматическая регистрация
При первом запуске `/start` бот автоматически создаёт профиль пользователя с балансом 0₽.

#### 2. Просмотр статуса
Команда "Статус" показывает:
- Имя пользователя
- Текущий баланс

#### 3. Пополнение баланса
1. Пользователь выбирает тариф (1 месяц, 3 месяца, 6 месяцев)
2. Получает ссылку на оплату через YooMoney
3. После оплаты баланс автоматически пополняется

#### 4. Автоматическое списание
Каждую полночь с пользователей с достаточным балансом списывается сумма `MINIMUM_BALANCE` (по умолчанию 3₽).

### Для администраторов

#### 1. Управление балансом
```
/up <username> <amount>
```
Пример: `/up @john 100` - добавит 100₽ к балансу пользователя @john

#### 2. Управление тарифами
```
/tariff <name> <price>
```
Пример: `/tariff MONTH_TARIFF 300` - изменит цену месячного тарифа на 300₽

#### 3. Уведомления
- Уведомление при успешной оплате пользователем
- Информация о сумме платежа и текущем балансе

## Conversations (сцены бота)

### Что такое Conversations?

В grammY вместо "сцен" используются **conversations** - это функции, которые управляют диалогом с пользователем.

### Список conversations

| Conversation | Назначение | Триггер |
|--------------|------------|---------|
| `start` | Приветствие нового пользователя | `/start` |
| `home` | Главное меню | Кнопка "Назад" |
| `status` | Отображение баланса и имени | Кнопка "Статус" |
| `get-access` | Выбор тарифного плана | Кнопка "Получить доступ" |
| `payment` | Процесс оплаты | После выбора тарифа |
| `question` | Помощь и поддержка | Кнопка "Вопросы" |
| `month-tariff` | Выбор тарифа на 30 дней | Кнопка "1 месяц" |
| `threemonth-tariff` | Выбор тарифа на 90 дней | Кнопка "3 месяца" |
| `sixmonth-tariff` | Выбор тарифа на 180 дней | Кнопка "6 месяцев" |

### Пример conversation

```typescript
export async function statusConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext
) {
  const userId = ctx.from?.id;
  const username = ctx.from?.username || 'не указан';

  if (!userId) return;

  // Получаем сервисы из контекста
  const userService: UserService = (ctx as any).userService;

  // Получаем данные пользователя
  const user = await userService.findOneByUserId(userId);
  const balance = user.balance.toLocaleString('ru-RU', {
    style: 'currency',
    currency: 'RUB',
  });

  await ctx.reply(`👤 Пользователь: ${username}\n💰 Баланс: ${balance}`, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}
```

## Платёжная система

### Workflow оплаты

```
1. Пользователь выбирает тариф
   ↓
2. Conversation сохраняет tariffId в session
   ↓
3. PaymentService создаёт платёж (status: PENDING)
   ↓
4. YooMoneyStrategy генерирует форму оплаты
   ↓
5. Пользователь получает ссылку на оплату
   ↓
6. PaymentScheduler проверяет статус каждые 10 секунд
   ↓
7. При успехе: статус → PAID, баланс пополняется
   ↓
8. Уведомления отправляются пользователю и админу
```

### Защита от двойного зачисления

Баланс пополняется **только один раз** при переходе статуса платежа из `PENDING` в `PAID`:

```typescript
if (paymentStatus !== payment.status) {
  // Зачисляем баланс только при изменении статуса
  await this.userService.commitBalanceChange(
    user,
    tariff.price,
    BalanceChangeTypeEnum.PAYMENT,
    paymentId
  );
}
```

### Автоматическое списание

Каждую полночь запускается scheduler:

```typescript
@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
async handleMidnight() {
  const serviceFee = this.botService.minimumBalance;
  const users = await this.userService.usersWithBalance(serviceFee);

  for (const user of users) {
    await this.userService.commitBalanceChange(
      user,
      -serviceFee,
      BalanceChangeTypeEnum.SCHEDULER
    );
  }
}
```

## База данных (Prisma)

### Модели

#### User
```prisma
model User {
  userId      Int      @id
  chatId      Int?
  firstname   String?
  lastname    String?
  username    String?
  balance     Int      # Баланс в рублях
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
  period   Int    # Период в днях
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
  balance      Int      # Баланс до изменения
  changeAmount Int      # Сумма изменения
  type         String   # PAYMENT, MANUALLY, SCHEDULER
  status       String   # DONE, INSUFFICIENT
  changeAt     DateTime @default(now())
}
```

### Управление БД

```bash
# Открыть Prisma Studio (GUI для БД)
npm run prisma:studio

# Создать миграцию
npm run prisma:migrate

# Применить миграции
npm run prisma:migrate:deploy

# Сгенерировать Prisma Client
npm run prisma:generate
```

## Deployment

### Development (Polling)

```bash
npm run start:dev
```

Бот будет работать в режиме long polling - подходит для разработки.

### Production (Webhook)

1. **Настройте HTTPS сервер**
2. **Установите переменную окружения:**
   ```env
   NODE_ENV=production
   ```
3. **Установите webhook:**
   ```bash
   npm run webhook:set
   ```
4. **Запустите бот:**
   ```bash
   npm run start:prod
   ```

Бот будет принимать обновления через webhook `https://your-domain.com/telegram/webhook`.

## Добавление новой функциональности

### Добавление новой conversation

1. **Создайте файл conversation:**
   ```typescript
   // src/grammy/conversations/my-feature.conversation.ts
   export async function myFeatureConversation(
     conversation: Conversation<MyContext>,
     ctx: MyContext
   ) {
     await ctx.reply('Hello from my feature!');

     // Ожидание ответа пользователя
     const response = await conversation.waitForCallbackQuery();

     // Обработка ответа
     await ctx.reply(`You clicked: ${response.data}`);
   }
   ```

2. **Зарегистрируйте в ConversationsRegistryService:**
   ```typescript
   bot.use(createConversation(myFeatureConversation));
   ```

3. **Добавьте кнопку в constants/buttons.const.ts:**
   ```typescript
   export const BUTTONS = {
     MY_FEATURE: { text: 'Моя фича', callback_data: CommandEnum.MY_FEATURE },
     // ...
   };
   ```

4. **Добавьте обработчик в bot.update.ts:**
   ```typescript
   bot.callbackQuery(CommandEnum.MY_FEATURE, async (ctx) => {
     await ctx.conversation.enter('myFeature');
   });
   ```

### Добавление нового сервиса

1. **Создайте модуль и сервис:**
   ```bash
   nest g module my-feature
   nest g service my-feature
   ```

2. **Инжектируйте сервис в context:**
   ```typescript
   // conversations-registry.service.ts
   private injectServicesIntoContext(bot: Bot<MyContext>) {
     bot.use(async (ctx, next) => {
       (ctx as any).myFeatureService = this.myFeatureService;
       await next();
     });
   }
   ```

3. **Используйте в conversation:**
   ```typescript
   const myService: MyFeatureService = (ctx as any).myFeatureService;
   const result = await myService.doSomething();
   ```

## Расширенные возможности

### Middleware Stack

```
User Update
    ↓
Session Middleware        # Сохранение состояния
    ↓
Hydrate Middleware        # Упрощение доступа к ctx
    ↓
Conversations Middleware  # Поддержка conversations
    ↓
Service Injection         # Внедрение сервисов в ctx
    ↓
Bot Handlers              # Обработка команд
    ↓
Conversations             # Логика диалогов
```

### Extended Context

```typescript
type MyContext = Context & ConversationFlavor & {
  session: SessionData;
  botService: BotService;
  userService: UserService;
  paymentService: PaymentService;
  tariffService: TariffService;
};
```

### Cron Jobs

```typescript
// Проверка pending платежей каждые 10 секунд
@Cron(CronExpression.EVERY_10_SECONDS)
async handlePendingPayments() {
  // ...
}

// Списание баланса каждую полночь
@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
async handleMidnight() {
  // ...
}
```

## Безопасность

### Текущие меры

- Admin-команды защищены проверкой chat ID
- Webhook валидация через секретный токен
- SHA1 хеш-валидация для YooMoney webhook
- Audit trail для всех изменений баланса

### Рекомендации для production

1. **Включите TLS verification:**
   ```typescript
   // Удалите эту строку из main-grammy.ts:
   process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
   ```

2. **Ограничьте CORS:**
   ```typescript
   app.enableCors({
     origin: 'https://your-domain.com',
     credentials: true,
   });
   ```

3. **Добавьте rate limiting:**
   ```bash
   npm install @nestjs/throttler
   ```

4. **Используйте environment-specific конфиги:**
   ```typescript
   ConfigModule.forRoot({
     isGlobal: true,
     envFilePath: `.env.${process.env.NODE_ENV}`,
   });
   ```

## Troubleshooting

### Бот не отвечает

1. Проверьте `BOT_TOKEN` в `.env`
2. Убедитесь, что бот запущен: `npm run start:dev`
3. Проверьте логи в консоли

### Webhook не работает

1. Проверьте HTTPS сертификат
2. Убедитесь, что `NODE_ENV=production`
3. Проверьте `TELEGRAM_SECRET_TOKEN` в `.env`
4. Проверьте endpoint: `POST /telegram/webhook`

### Платежи не зачисляются

1. Проверьте `YOOMONEY_SECRET` в `.env`
2. Убедитесь, что PaymentScheduler запущен
3. Проверьте статус платежа в Prisma Studio
4. Проверьте логи PaymentService

### База данных не создаётся

1. Запустите: `npm run prisma:generate`
2. Запустите: `npm run prisma:migrate`
3. Проверьте `DATABASE_URL` в `.env`

## Документация

- [PAYMENT-WORKFLOW.md](PAYMENT-WORKFLOW.md) - Детальное описание логики платежей
- [PROJECT-STRUCTURE.md](PROJECT-STRUCTURE.md) - Структура проекта
- [QUICK-START.md](QUICK-START.md) - Быстрый старт

## Ресурсы

- [grammY Documentation](https://grammy.dev)
- [NestJS Documentation](https://nestjs.com)
- [Prisma Documentation](https://prisma.io)
- [YooMoney API](https://yoomoney.ru/docs)

## Лицензия

MIT

---

**Готовый шаблон для вашего Telegram бота!** 🚀
