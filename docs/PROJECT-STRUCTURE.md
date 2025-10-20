# Структура проекта BananaBot

## 📁 Обзор архитектуры

Проект поддерживает **две параллельные реализации** Telegram бота:
- **Telegraf** (legacy) - в `src/telegraf/`
- **grammY** (modern) - в `src/grammy/`

Обе версии используют общие бизнес-модули и базу данных.

```
bananabot_rewriting_vpnssconf/
├── src/
│   ├── telegraf/                    # Telegraf implementation
│   │   ├── bot.module.ts            # Main module (Telegraf)
│   │   ├── bot.service.ts           # Bot service (Telegraf)
│   │   ├── bot.update.ts            # Update handlers (Telegraf)
│   │   ├── bot.controller.ts        # HTTP controller
│   │   ├── scenes/                  # Telegraf scenes
│   │   │   ├── start.scene.ts
│   │   │   ├── home.scene.ts
│   │   │   ├── connect.scene.ts
│   │   │   ├── payment.scene.ts
│   │   │   ├── get-access.scene.ts
│   │   │   ├── status.scene.ts
│   │   │   ├── question.scene.ts
│   │   │   ├── month-tariff.scene.ts
│   │   │   ├── threemonth-tariff.scene.ts
│   │   │   └── sixmonth-tariff.scene.ts
│   │   ├── abstract/
│   │   │   └── abstract.scene.ts    # Base scene class
│   │   ├── interfaces/
│   │   │   └── context.interface.ts # Telegraf context
│   │   ├── constants/
│   │   │   ├── bot-name.const.ts
│   │   │   ├── buttons.const.ts
│   │   │   └── scenes.const.ts
│   │   └── middlewares/
│   │       └── command-args.middleware.ts
│   │
│   ├── grammy/                      # grammY implementation
│   │   ├── bot.module.ts            # Main module (grammY)
│   │   ├── bot.service.ts           # Bot service (grammY)
│   │   ├── bot.update.ts            # Update handlers (grammY)
│   │   ├── grammy.module.ts         # grammY core module
│   │   ├── grammy.service.ts        # grammY bot wrapper
│   │   ├── grammy-context.interface.ts # grammY context
│   │   ├── webhook.controller.ts    # Webhook controller
│   │   ├── conversations/           # grammY conversations
│   │   │   ├── base.conversation.ts
│   │   │   ├── conversations-registry.service.ts
│   │   │   ├── start.conversation.ts
│   │   │   ├── home.conversation.ts
│   │   │   ├── connect.conversation.ts
│   │   │   ├── payment.conversation.ts
│   │   │   ├── get-access.conversation.ts
│   │   │   ├── status.conversation.ts
│   │   │   ├── question.conversation.ts
│   │   │   ├── month-tariff.conversation.ts
│   │   │   ├── threemonth-tariff.conversation.ts
│   │   │   └── sixmonth-tariff.conversation.ts
│   │   └── constants/
│   │       ├── buttons.const.ts
│   │       └── scenes.const.ts
│   │
│   ├── main.ts                      # Default entry point
│   ├── main-telegraf.ts             # Telegraf entry point
│   ├── main-grammy.ts               # grammY entry point
│   │
│   ├── prisma/                      # ⚙️ SHARED: Database layer
│   │   ├── schema.prisma
│   │   ├── prisma.module.ts
│   │   ├── prisma.service.ts
│   │   ├── connection.service.ts
│   │   └── dev.db
│   │
│   ├── payment/                     # ⚙️ SHARED: Payment processing
│   │   ├── payment.module.ts
│   │   ├── payment.service.ts
│   │   ├── payment.controller.ts
│   │   ├── strategies/
│   │   │   ├── payment-strategy.factory.ts
│   │   │   └── yoomoney-payment.strategy.ts
│   │   └── enum/
│   │       ├── payment-system.enum.ts
│   │       └── balancechange-type.enum.ts
│   │
│   ├── user/                        # ⚙️ SHARED: User management
│   │   ├── user.module.ts
│   │   └── user.service.ts
│   │
│   ├── tariff/                      # ⚙️ SHARED: Tariff management
│   │   ├── tariff.module.ts
│   │   └── tariff.service.ts
│   │
│   ├── outline/                     # ⚙️ SHARED: VPN connection
│   │   ├── outline.service.ts
│   │   └── outline.controller.ts
│   │
│   ├── utils/                       # ⚙️ SHARED: Utilities
│   │   ├── reply-or-edit.ts
│   │   └── split-array-into-pairs.ts
│   │
│   ├── filters/                     # ⚙️ SHARED: Exception filters
│   │   └── all-exception.filter.ts
│   │
│   ├── interceptors/                # ⚙️ SHARED: Interceptors
│   │   └── response-time-interceptor.service.ts
│   │
│   ├── enum/                        # ⚙️ SHARED: Enums
│   │   └── command.enum.ts
│   │
│   ├── constants/                   # ⚙️ SHARED: Original constants (legacy)
│   │   ├── bot-name.const.ts
│   │   ├── buttons.const.ts
│   │   └── scenes.const.ts
│   │
│   └── middlewares/                 # ⚙️ SHARED: Original middlewares (legacy)
│       └── command-args.middleware.ts
│
├── libs/                            # Custom libraries
│   └── yoomoney-client/
│
├── scripts/                         # Utility scripts
│   └── set-webhook.ts
│
├── package.json                     # Dependencies (both frameworks)
├── package-grammy.json              # grammY-specific dependencies reference
├── tsconfig.json
│
├── SWITCHING-VERSIONS.md            # Guide to switch between versions
├── PROJECT-STRUCTURE.md             # This file
├── MIGRATION-GUIDE.md               # Migration documentation
├── MIGRATION-SUMMARY.md             # Migration summary
├── README-GRAMMY.md                 # grammY documentation
└── GETTING-STARTED-GRAMMY.md        # grammY getting started
```

## 🔑 Ключевые концепции

### 1. Разделение по фреймворкам

- **`src/telegraf/`** - Полностью изолированная реализация на Telegraf
- **`src/grammy/`** - Полностью изолированная реализация на grammY
- **Shared modules** - Общие бизнес-модули используются обеими версиями

### 2. Entry Points (точки входа)

| Файл | Описание | Запуск |
|------|----------|--------|
| `main.ts` | Default (может указывать на любую версию) | `npm run start:dev` |
| `main-telegraf.ts` | Telegraf version | `npm run start:telegraf:dev` |
| `main-grammy.ts` | grammY version | `npm run start:grammy:dev` |

### 3. Общие модули (SHARED)

Эти модули используются **обеими** версиями:

- **PrismaModule** - работа с базой данных (SQLite)
- **PaymentModule** - обработка платежей (YooMoney)
- **UserModule** - управление пользователями
- **TariffModule** - управление тарифами
- **OutlineModule** - управление VPN подключениями
- **Utils** - вспомогательные функции
- **Filters** - глобальные фильтры ошибок
- **Interceptors** - перехватчики
- **Enums** - перечисления (CommandEnum и др.)

## 📊 Сравнение реализаций

| Aspect | Telegraf | grammY |
|--------|----------|--------|
| **Декораторы** | `@Update()`, `@Command()`, `@Action()` | Явная регистрация в `onModuleInit()` |
| **Сцены** | `@Scene()`, `@SceneEnter()`, `@SceneLeave()` | Conversations (функции) |
| **Контекст** | `Context` (Telegraf) | `MyContext` (grammY) |
| **Session** | `ctx.session` | `ctx.session` + `SessionFlavor` |
| **Навигация** | `ctx.scene.enter(sceneName)` | `ctx.conversation.enter(conversationName)` |
| **Keyboard** | `Markup.keyboard()`, `Markup.inlineKeyboard()` | `new Keyboard()`, `new InlineKeyboard()` |
| **Buttons** | `Markup.button.callback()`, `Markup.button.url()` | `{text, callback_data}`, `{text, url}` |

## 🚀 Команды запуска

### Telegraf

```bash
# Development
npm run start:telegraf:dev

# Production
npm run build
npm run start:telegraf:prod

# With migrations
npm run start:migrate:telegraf:prod
```

### grammY

```bash
# Development
npm run start:grammy:dev

# Production
npm run build
npm run start:grammy:prod

# With migrations
npm run start:migrate:grammy:prod
```

## 🗄️ База данных

Обе версии используют **одну и ту же базу данных**:
- SQLite (`src/prisma/dev.db`)
- Prisma ORM
- Схема: `src/prisma/schema.prisma`

### Основные таблицы:
- **User** - пользователи
- **Connection** - VPN подключения
- **Payment** - платежи
- **Tariff** - тарифы
- **BalanceChange** - история изменений баланса
- **SceneStep** - история навигации по сценам

## 📝 Важные файлы

### Конфигурация

- `.env` - переменные окружения
- `tsconfig.json` - TypeScript конфигурация
- `nest-cli.json` - NestJS CLI конфигурация

### Документация

- `SWITCHING-VERSIONS.md` - как переключаться между версиями
- `MIGRATION-GUIDE.md` - руководство по миграции
- `MIGRATION-SUMMARY.md` - краткая сводка миграции
- `README-GRAMMY.md` - документация grammY версии
- `CLAUDE.md` - инструкции для Claude AI

## ⚠️ Важные примечания

1. **Не смешивайте импорты**: не импортируйте модули из `telegraf/` в `grammy/` и наоборот
2. **Shared модули**: бизнес-логика в shared модулях должна быть framework-agnostic
3. **База данных**: одна БД для обеих версий - будьте внимательны при тестировании
4. **Port conflicts**: не запускайте обе версии одновременно на одном порту
5. **Environment variables**: используйте одни и те же переменные окружения

## 🔧 Следующие шаги

1. Установите зависимости: `npm install`
2. Настройте `.env` файл
3. Выберите версию для запуска
4. Запустите: `npm run start:telegraf:dev` или `npm run start:grammy:dev`

Подробнее см. [SWITCHING-VERSIONS.md](SWITCHING-VERSIONS.md)
