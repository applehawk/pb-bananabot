# Настройка развертывания в Amvera Cloud

## Исправленные проблемы

### 1. Конфликт портов
- **Было**: Dockerfile использовал порт 3000, а amvera.yml ожидал порт 80
- **Исправлено**: Оба файла теперь используют порт 3000

### 2. Отсутствующие файлы конфигурации
- Добавлен `nest-cli.json` в Dockerfile для корректной сборки NestJS
- Разкомментированы миграции Prisma в `.dockerignore`

### 3. Персистентное хранилище
- Создана директория `/data` для постоянного хранения данных
- Настроен `persistenceMount: /data` в `amvera.yml`

## Обязательные переменные окружения в Amvera

В панели Amvera необходимо настроить следующие переменные окружения:

### Обязательные переменные

```bash
# Database (используйте внешнюю PostgreSQL базу данных)
DATABASE_URL=postgresql://user:password@host:5432/database?schema=public
DATABASE_HOST=<host>
DATABASE_PORT=5432
DATABASE_USER=<user>
DATABASE_PASSWORD=<password>
DATABASE_NAME=<database>

# Telegram Bot
TELEGRAM_BOT_TOKEN=<your_bot_token>

# Gemini AI
GEMINI_API_KEY=<your_gemini_api_key>
GEMINI_MODEL=gemini-2.5-flash-image

# YooMoney
YOOMONEY_TOKEN=<your_token>
YOOMONEY_SECRET=<your_secret>
YOOMONEY_SUCCESS_URL=<your_success_url>

# Application
NODE_ENV=production
PORT=3000
```

### Опциональные переменные (с дефолтными значениями)

```bash
# Redis (опционально)
REDIS_URL=redis://localhost:6379

# Storage
STORAGE_TYPE=telegram

# Credits
FREE_CREDITS=3
COST_TEXT_TO_IMAGE=1
COST_IMAGE_TO_IMAGE=1.5
COST_MULTI_IMAGE_2_4=2
COST_MULTI_IMAGE_5_16=3
COST_BATCH_MULTIPLIER=0.9

# Referral System
REFERRAL_BONUS_REFERRER=3
REFERRAL_BONUS_REFERRED=3

# Daily Bonus
DAILY_BONUS_MIN=0.5
DAILY_BONUS_MAX=5
DAILY_BONUS_STREAK_MULTIPLIER=0.1
```

## Настройка базы данных

### Вариант 1: Использование встроенной PostgreSQL от Amvera

1. В панели Amvera создайте сервис PostgreSQL
2. Скопируйте строку подключения из настроек сервиса
3. Добавьте её в переменные окружения как `DATABASE_URL`

### Вариант 2: Внешняя база данных

Можно использовать внешние сервисы:
- [Supabase](https://supabase.com) (бесплатный тариф)
- [Neon](https://neon.tech) (бесплатный тариф)
- [Railway](https://railway.app) (бесплатный тариф с ограничениями)

## Процесс развертывания

1. **Подключите репозиторий** к Amvera
2. **Настройте переменные окружения** в разделе "Переменные"
3. **Запустите сборку** - Amvera автоматически обнаружит `amvera.yml`
4. **Проверьте логи** сборки на наличие ошибок
5. **Дождитесь запуска** приложения

## Проверка работоспособности

После развертывания проверьте:

1. **Health endpoint**: `https://your-app.amvera.io/health`
2. **Логи приложения** в панели Amvera
3. **Telegram бот** - отправьте команду `/start`

## Структура файлов для Amvera

```
bananabot/
├── amvera.yml              # Конфигурация Amvera
├── Dockerfile              # Сборка Docker образа
├── .dockerignore           # Исключения для Docker
├── nest-cli.json           # Конфигурация NestJS CLI
├── package.json            # Зависимости Node.js
├── tsconfig.json           # Конфигурация TypeScript
├── tsconfig.build.json     # Конфигурация сборки
├── prisma/                 # Схема и миграции БД
│   ├── schema.prisma
│   └── migrations/
└── src/                    # Исходный код
    └── main-grammy.ts      # Точка входа
```

## Важные замечания

1. **База данных**: Amvera НЕ поддерживает docker-compose, поэтому PostgreSQL нужно запускать отдельно
2. **Redis**: Если используете Redis, также запустите его как отдельный сервис
3. **Миграции**: Выполняются автоматически при старте контейнера
4. **Порты**: Используется порт 3000 (указан в `amvera.yml` и `Dockerfile`)
5. **Персистентность**: Данные сохраняются в `/data` (если нужно)

## Возможные проблемы

### Ошибка сборки

Если возникает ошибка сборки:
1. Проверьте логи сборки в панели Amvera
2. Убедитесь, что все переменные окружения настроены
3. Проверьте, что репозиторий содержит все необходимые файлы

### База данных недоступна

Если приложение не может подключиться к БД:
1. Проверьте `DATABASE_URL` в переменных окружения
2. Убедитесь, что PostgreSQL сервис запущен
3. Проверьте правильность хоста и порта

### Бот не отвечает

Если бот не отвечает на команды:
1. Проверьте `TELEGRAM_BOT_TOKEN`
2. Проверьте логи приложения
3. Убедитесь, что webhook не установлен (или установлен правильно)

## Полезные ссылки

- [Документация Amvera](https://docs.amvera.ru/)
- [Настройка конфигурации](https://docs.amvera.ru/applications/configuration/config-file.html)
- [Docker в Amvera](https://docs.amvera.ru/applications/configuration/docker.html)
- [Сохранение данных](https://docs.amvera.ru/general/FAQ/data-saving.html)
