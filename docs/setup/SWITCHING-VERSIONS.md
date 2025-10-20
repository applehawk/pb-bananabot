# Переключение между Telegraf и grammY

Проект поддерживает две версии Telegram bot фреймворков:
- **Telegraf** (оригинальная реализация) - в папке `src/telegraf/`
- **grammY** (новая реализация) - в папке `src/grammy/`

## Структура проекта

```
src/
├── telegraf/              # Telegraf implementation
│   ├── bot.module.ts
│   ├── bot.service.ts
│   ├── bot.update.ts
│   ├── scenes/
│   ├── constants/
│   ├── interfaces/
│   ├── abstract/
│   └── middlewares/
│
├── grammy/                # grammY implementation
│   ├── bot.module.ts
│   ├── bot.service.ts
│   ├── bot.update.ts
│   ├── grammy.module.ts
│   ├── grammy.service.ts
│   ├── conversations/
│   └── constants/
│
├── main-telegraf.ts       # Entry point for Telegraf
├── main-grammy.ts         # Entry point for grammY
└── main.ts                # Default entry point (points to one of the above)
```

## Запуск Telegraf версии

### Development режим
```bash
npm run start:telegraf:dev
```

### Production режим
```bash
npm run build
npm run start:telegraf:prod
```

### С миграциями базы данных
```bash
npm run start:migrate:telegraf:prod
```

## Запуск grammY версии

### Development режим
```bash
npm run start:grammy:dev
```

### Production режим
```bash
npm run build
npm run start:grammy:prod
```

### С миграциями базы данных
```bash
npm run start:migrate:grammy:prod
```

## Общие модули

Следующие модули используются обеими версиями:
- `src/prisma/` - database layer
- `src/payment/` - payment processing
- `src/user/` - user management
- `src/tariff/` - tariff management
- `src/outline/` - VPN connection management
- `src/utils/` - utility functions
- `src/filters/` - exception filters
- `src/interceptors/` - interceptors
- `src/enum/` - enums

## Различия между версиями

### Telegraf
- Использует декораторы: `@Update()`, `@Command()`, `@Action()`, `@Hears()`
- Scenes с `@SceneEnter()` и `@SceneLeave()`
- Встроенная система сцен через `nestjs-telegraf`

### grammY
- Использует явную регистрацию обработчиков в `onModuleInit()`
- Conversations через `@grammyjs/conversations`
- Более современный API: `bot.command()`, `bot.on()`
- Поддержка middleware injection для conversations

## Переключение по умолчанию

Чтобы изменить версию по умолчанию (используемую через `npm run start`), обновите `src/main.ts`:

### Для Telegraf (по умолчанию):
```typescript
import { NestFactory } from '@nestjs/core';
import { BotModule } from './telegraf/bot.module';
// ...
```

### Для grammY:
```typescript
import { NestFactory } from '@nestjs/core';
import { BotModule } from './grammy/bot.module';
// ...
```

## Тестирование

Обе версии должны работать идентично с точки зрения бизнес-логики:
- Одинаковые команды: `/start`, `/tariff`, `/up`
- Одинаковые кнопки и UI
- Одинаковые сцены/conversations
- Одна база данных
- Одни и те же сервисы (Payment, User, Tariff, Outline)

## Примечания

- Оригинальный код Telegraf сохранён в `src/telegraf/` без изменений (кроме путей импортов)
- Код grammY в `src/grammy/` - это переработанная версия с новым API
- Обе версии могут работать параллельно (на разных портах)
- Используйте переменные окружения для конфигурации (`BOT_TOKEN`, `DATABASE_URL`, и т.д.)
