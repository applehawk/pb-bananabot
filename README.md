# 🍌 BananaBot - Telegram Image Generation Bot

> **Полнофункциональный Telegram бот для генерации изображений с помощью AI, включающий систему кредитов, платежи и админ-панель**

[![NestJS](https://img.shields.io/badge/NestJS-10.x-red.svg)](https://nestjs.com/)
[![grammY](https://img.shields.io/badge/grammY-1.21.1-green.svg)](https://grammy.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-2D3748.svg)](https://www.prisma.io/)
[![Next.js](https://img.shields.io/badge/Next.js-15.x-black.svg)](https://nextjs.org/)

## 📋 Содержание

- [Обзор](#-обзор)
- [Архитектура проекта](#-архитектура-проекта)
- [Быстрый старт](#-быстрый-старт)
- [Развертывание](#-развертывание)
  - [Локальная разработка](#локальная-разработка-docker-compose)
  - [Развертывание на Amvera](#развертывание-на-amvera)
- [Документация](#-документация)
- [Возможности](#-возможности)
- [Технологии](#-технологии)
- [Структура проекта](#-структура-проекта)
- [Команды](#-команды)
- [Переменные окружения](#-переменные-окружения)

---

## 🎯 Обзор

**BananaBot** — это полнофункциональный Telegram бот для генерации изображений с помощью AI. Включает систему кредитов, интеграцию с платежными системами (YooMoney, Telegram Stars), реферальную программу и веб-админ-панель на Next.js.

### Ключевые особенности:

✅ **AI генерация изображений** - text-to-image, image-to-image, multi-image

✅ **Система кредитов** - гибкая тарификация и пакеты

✅ **Множественные способы оплаты** - YooMoney, Telegram Stars, криптовалюта

✅ **Реферальная программа** - бонусы за приглашение друзей

✅ **Ежедневные бонусы** - система стриков для активных пользователей

✅ **Веб-админ-панель** - управление пользователями, аналитика, настройки

✅ **Модульная архитектура** - отдельные submodules для Prisma и админ-панели

✅ **Полная типизация** - TypeScript для надежности кода

✅ **Docker-ready** - готовые конфигурации для локальной и production разработки

---

## 🏗 Архитектура проекта

Проект состоит из трех основных компонентов, организованных как Git submodules:

```
bananabot/                        # Основной репозиторий (Telegram Bot)
├── prisma/                       # Submodule: Shared Prisma schema
│   ├── schema.prisma            # Общая схема БД
│   ├── migrations/              # Миграции БД
│   └── package.json
│
├── bananabot-admin/             # Submodule: Admin Panel (Next.js)
│   ├── app/                     # Next.js 15 App Router
│   ├── components/              # React компоненты
│   ├── prisma/                  # Symlink на основной prisma submodule
│   └── Dockerfile
│
├── src/                         # Основной код бота
│   ├── grammy/                  # Telegram Bot логика
│   ├── payment/                 # Платежная система
│   ├── user/                    # Управление пользователями
│   └── ...
│
├── Dockerfile                   # Docker образ для бота
├── docker-compose.yml           # Локальная разработка
├── docker-compose.amvera.yml    # Развертывание на Amvera
└── Makefile                     # Удобные команды
```

### Submodules:

1. **prisma** - Shared Prisma схема и миграции, используемые ботом и админ-панелью
2. **bananabot-admin** - Next.js веб-приложение для администрирования

---

## ⚡ Быстрый старт

### Предварительные требования

- Node.js 20+
- npm или pnpm
- Docker и Docker Compose (для контейнеризации)
- PostgreSQL 16+ (или через Docker)

### Установка

```bash
# 1. Клонировать репозиторий с submodules
git clone --recurse-submodules https://github.com/yourusername/bananabot.git
cd bananabot

# Если вы уже клонировали без --recurse-submodules:
git submodule update --init --recursive

# 2. Установить зависимости для основного проекта
npm install

# 3. Установить зависимости для Prisma submodule
cd prisma
npm install
cd ..

# 4. Установить зависимости для Admin Panel
cd bananabot-admin
pnpm install
cd ..

# 5. Настроить переменные окружения
cp .env.example .env
# Отредактируйте .env: добавьте BOT_TOKEN, DATABASE_URL и другие параметры

# Также настройте .env для админ-панели
cp bananabot-admin/.env.example bananabot-admin/.env
# Отредактируйте bananabot-admin/.env

# 6. Инициализировать базу данных
cd prisma
npx prisma generate
npx prisma migrate deploy
cd ..

# 7. Запустить бота в режиме разработки
npm run start:dev
```

**Готово!** 🎉 Бот запущен и готов к работе.

Подробная инструкция: [QUICK_START.md](QUICK_START.md)

---

## 🚀 Развертывание

### Локальная разработка (Docker Compose)

Используйте `docker-compose.yml` для запуска всех сервисов локально:

```bash
# Запустить все сервисы (PostgreSQL, Redis, Bot, Admin)
make docker-up
# или короткий алиас:
make up

# Или напрямую через docker-compose
docker-compose up -d

# Просмотр логов
make docker-logs
# или:
make logs

# Остановка всех сервисов
make docker-down
# или:
make down

# Показать статус сервисов
make docker-ps
# или:
make ps
```

**Сервисы:**
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- Bot: `localhost:3000`
- Admin Panel: `localhost:3001`

### Развертывание на Amvera

Amvera — это платформа для развертывания приложений. Полная инструкция: [Документация Amvera](https://docs.amvera.ru/)

#### Шаг 1: Создание PostgreSQL базы данных

1. Откройте [Amvera Dashboard](https://amvera.ru/)
2. Выберите "PostgreSQL" и нажмите "Создать базу данных"
3. Настройте параметры:
   - Название проекта: `bananabot-db`
   - Тариф: минимум "Starter"
   - Имя БД: `bananabot`
   - Username и Password: сохраните для дальнейшей настройки

4. После создания получите строку подключения:
   ```
   postgresql://username:password@amvera-<username>-cnpg-bananabot-db-rw:5432/bananabot?schema=public
   ```

#### Шаг 2: Развертывание Telegram Bot

1. В Amvera создайте новый проект "Application"
2. Подключите Git репозиторий:
   ```bash
   git remote add amvera <amvera-git-url>
   git push amvera main
   ```

3. Настройте переменные окружения в Amvera Dashboard:
   ```bash
   NODE_ENV=production
   DATABASE_URL=postgresql://username:password@amvera-<username>-cnpg-bananabot-db-rw:5432/bananabot?schema=public
   BOT_TOKEN=<your_bot_token>
   ADMIN_CHAT_ID=<your_telegram_id>
   PORT=80
   DOMAIN=https://<your-project>.amvera.io
   YOOMONEY_SECRET=<your_secret>
   ```

4. Amvera автоматически обнаружит `Dockerfile` и соберет приложение

5. После развертывания настройте webhook:
   ```bash
   npm run webhook:set
   ```

#### Шаг 3: Развертывание Admin Panel

1. Создайте еще один проект в Amvera для админ-панели
2. При настройке укажите:
   - Build context: `bananabot-admin`
   - Dockerfile: `bananabot-admin/Dockerfile`

3. Настройте переменные окружения:
   ```bash
   NODE_ENV=production
   DATABASE_URL=<same_as_bot>
   PORT=80
   NEXTAUTH_SECRET=<generate_random_string>
   NEXTAUTH_URL=https://<your-admin-project>.amvera.io
   ```

4. Админ-панель будет доступна по адресу:
   ```
   https://<your-admin-project>.<username>.amvera.io
   ```

#### Шаг 4: Настройка доменов (опционально)

Для использования собственного домена:

1. В регистраторе домена создайте A и TXT записи
2. В Amvera Dashboard привяжите домен к проекту
3. Amvera автоматически выпустит SSL сертификат

**Важные особенности Amvera:**

- ✅ Автоматические SSL сертификаты
- ✅ Managed PostgreSQL с бесплатными бэкапами
- ✅ Внутренняя сеть для связи между сервисами: `amvera-<project>-run-<username>`
- ✅ Автоматические сборки при push в master
- ⚠️ Файлы в `.gitignore` не включаются в сборку
- ⚠️ Submodules требуют инициализации: `git submodule update --init --recursive`

Подробнее: [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)

---

## 📚 Документация

### Основная документация

| Документ | Описание |
|----------|----------|
| **[Quick Start](QUICK_START.md)** | Подробная инструкция по установке и запуску |
| **[Commands Cheatsheet](COMMANDS_CHEATSHEET.md)** | Краткая шпаргалка по всем командам |
| **[Makefile Examples](.makefile-examples.md)** | Примеры использования Makefile |

### Развертывание

| Документ | Описание |
|----------|----------|
| **[Docker Deployment](DOCKER_DEPLOYMENT.md)** | Локальное развертывание в Docker |
| **[Amvera Deployment](AMVERA_DEPLOYMENT.md)** | Развертывание на платформе Amvera |

### Разработка

| Документ | Описание |
|----------|----------|
| **[Submodules Guide](SUBMODULES_GUIDE.md)** | Работа с Git submodules |
| **[Project Structure](docs/PROJECT-STRUCTURE.md)** | Структура проекта и описание модулей |
| **[Payment Workflow](docs/PAYMENT-WORKFLOW.md)** | Логика работы платежной системы |

---

## ✨ Возможности

### Для пользователей:

- 🎨 **AI генерация изображений** - text-to-image, image-to-image, multi-image
- 📱 **Простой интерфейс** - интуитивная навигация через inline-кнопки
- 💳 **Множественные способы оплаты** - YooMoney, Telegram Stars, Crypto
- 📊 **Управление кредитами** - просмотр баланса, пополнение
- 🎁 **Реферальная программа** - бонусы за приглашение друзей
- 🎯 **Ежедневные бонусы** - система стриков
- ⚙️ **Настройки генерации** - aspect ratio, количество изображений, HD качество
- 🔔 **Уведомления** - о завершении генерации, бонусах

### Для администраторов:

- 💼 **Веб-панель** - Next.js админ-панель с аналитикой
- 👨‍💼 **Управление пользователями** - просмотр, редактирование, блокировка
- 📈 **Аналитика** - графики активности, доходов, использования
- 🎁 **Промо-коды** - создание и управление
- 💰 **Управление тарифами** - гибкая настройка пакетов кредитов
- 📝 **История операций** - полный аудит транзакций
- 🔧 **Конфигурация** - настройка всех параметров системы

---

## 🛠 Технологии

### Backend (Bot)

- **[NestJS](https://nestjs.com/)** - прогрессивный Node.js фреймворк
- **[TypeScript](https://www.typescriptlang.org/)** - типизированный JavaScript
- **[Prisma](https://www.prisma.io/)** - современный ORM для работы с БД
- **[PostgreSQL](https://www.postgresql.org/)** - реляционная база данных

### Telegram Bot

- **[grammY](https://grammy.dev/)** - современный фреймворк для Telegram Bot API
- **[Conversations](https://grammy.dev/plugins/conversations.html)** - плагин для диалоговых сценариев
- **[@grammyjs/hydrate](https://grammy.dev/plugins/hydrate.html)** - плагин для hydration API

### Frontend (Admin Panel)

- **[Next.js 15](https://nextjs.org/)** - React фреймворк с App Router
- **[React 19](https://react.dev/)** - библиотека для UI
- **[TypeScript](https://www.typescriptlang.org/)** - типизация
- **[Tailwind CSS](https://tailwindcss.com/)** - utility-first CSS
- **[NextAuth.js](https://next-auth.js.org/)** - аутентификация
- **[Recharts](https://recharts.org/)** - графики и аналитика

### Payments & Infrastructure

- **[YooMoney SDK](https://yoomoney.ru/)** - платежная система (бывший Яндекс.Деньги)
- **[Telegram Stars](https://core.telegram.org/bots/payments)** - встроенные платежи Telegram
- **[@nestjs/schedule](https://docs.nestjs.com/techniques/task-scheduling)** - планировщик задач (cron jobs)
- **[Docker](https://www.docker.com/)** - контейнеризация
- **[Redis](https://redis.io/)** - кеширование и сессии

---

## 📂 Структура проекта

```
bananabot/
├── src/                         # Основной код бота
│   ├── grammy/                  # 🤖 Telegram Bot (grammY)
│   │   ├── bot.module.ts        # Главный модуль приложения
│   │   ├── bot.service.ts       # Сервис бота
│   │   ├── bot.update.ts        # Обработчики команд
│   │   ├── conversations/       # Диалоговые сценарии
│   │   └── constants/           # Кнопки и конфигурация
│   │
│   ├── payment/                 # 💳 Платежная система
│   │   ├── payment.service.ts   # Создание и валидация платежей
│   │   ├── payment.controller.ts # Webhook от платежных систем
│   │   ├── payment.scheduler.ts # Cron jobs
│   │   └── strategies/          # Strategy Pattern
│   │
│   ├── user/                    # 👤 Управление пользователями
│   │   └── user.service.ts      # CRUD + кредиты + история
│   │
│   ├── generation/              # 🎨 AI генерация изображений
│   │   └── generation.service.ts # Логика генерации
│   │
│   └── main.ts                  # 🚀 Точка входа
│
├── prisma/                      # 📦 Submodule: Shared Prisma
│   ├── schema.prisma            # Схема БД (User, Transaction, Generation)
│   ├── migrations/              # Миграции БД
│   └── package.json
│
├── bananabot-admin/             # 📦 Submodule: Admin Panel
│   ├── app/                     # Next.js App Router
│   │   ├── (dashboard)/         # Dashboard routes
│   │   ├── api/                 # API routes
│   │   └── layout.tsx           # Root layout
│   │
│   ├── components/              # React компоненты
│   │   ├── ui/                  # UI компоненты
│   │   └── charts/              # Графики аналитики
│   │
│   ├── lib/                     # Утилиты и helpers
│   ├── prisma/                  # Symlink на ../prisma
│   └── Dockerfile
│
├── docs/                        # 📚 Документация
├── scripts/                     # 🛠 Утилиты
│
├── Dockerfile                   # Docker образ бота
├── docker-compose.yml           # Локальная разработка
├── docker-compose.amvera.yml    # Развертывание на Amvera
├── Makefile                     # Удобные команды
└── .gitmodules                  # Конфигурация submodules
```

**Детали**: См. [PROJECT-STRUCTURE.md](docs/PROJECT-STRUCTURE.md)

---

## 🎮 Команды

### Makefile команды (рекомендуется)

```bash
# Development
make dev                # Запустить бота в dev режиме
make build              # Собрать production билд
make start              # Запустить production билд

# Docker (полные имена)
make docker-up          # Запустить все сервисы в Docker
make docker-down        # Остановить все сервисы
make docker-logs        # Просмотр логов
make docker-restart     # Перезапустить все сервисы
make docker-ps          # Показать статус сервисов
make docker-build       # Пересобрать Docker образы

# Docker (короткие алиасы)
make up                 # Алиас для docker-up
make down               # Алиас для docker-down
make logs               # Алиас для docker-logs
make ps                 # Алиас для docker-ps

# Database
make db-generate        # Сгенерировать Prisma Client
make db-migrate         # Создать и применить миграцию
make db-studio          # Открыть Prisma Studio
make db-push            # Push схемы без миграции
make db-reset           # Сбросить БД (⚠️ удалит все данные)

# Submodules
make submodules-init    # Инициализировать submodules
make submodules-update  # Обновить submodules
make submodules-pull    # Pull изменений в submodules
make submodules-status  # Статус submodules

# Admin Panel
make admin-install      # Установить зависимости админ-панели
make admin-dev          # Запустить админ-панель в dev режиме
make admin-build        # Собрать админ-панель для production
make admin-prod         # Запустить админ-панель в Docker
make admin-stop         # Остановить админ-панель в Docker

# Webhook
make webhook-set        # Установить Telegram webhook
make webhook-delete     # Удалить Telegram webhook

# Cleaning
make clean              # Очистить временные файлы
make clean-all          # Полная очистка (включая node_modules)

# Combined
make setup              # Полная настройка окружения (submodules + deps)
make setup-db           # Настройка + инициализация БД
make deploy             # Полное развертывание (submodules + build + docker)
make fresh              # Чистая установка (clean-all + install + build)
```

### npm команды

```bash
# Development
npm run start:dev       # Запуск в режиме разработки (polling)
npm run build           # Сборка production билда
npm run start:prod      # Запуск production (webhook)

# Database
npm run prisma:generate # Генерация Prisma Client
npm run prisma:migrate  # Создать и применить миграцию
npm run prisma:studio   # Открыть GUI для работы с БД

# Webhook
npm run webhook:set     # Установить Telegram webhook
npm run webhook:delete  # Удалить Telegram webhook

# Другие
npm run lint            # Проверка кода ESLint
npm run test            # Запуск тестов
```

---

## 🔐 Переменные окружения

### Основной проект (Bot)

Создайте файл `.env` в корне проекта:

```bash
# Telegram Bot (обязательные)
BOT_TOKEN=your_telegram_bot_token
ADMIN_CHAT_ID=your_telegram_chat_id

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/bananabot?schema=public

# Server
PORT=3000
NODE_ENV=development
DOMAIN=https://your-domain.com

# Payment
YOOMONEY_SECRET=your_yoomoney_webhook_secret

# AI Generation (example)
IMAGEN_API_KEY=your_ai_api_key

# Optional
ADMIN_CHAT_ID_2=second_admin_chat_id
TELEGRAM_SECRET_TOKEN=webhook_secret
REDIS_URL=redis://localhost:6379
```

### Admin Panel

Создайте файл `bananabot-admin/.env`:

```bash
# Database (та же, что у бота)
DATABASE_URL=postgresql://user:password@localhost:5432/bananabot?schema=public

# Next.js
PORT=3001
NEXTAUTH_SECRET=your_random_secret_32_chars_min
NEXTAUTH_URL=http://localhost:3001

# Optional: Bot API
BOT_API_URL=http://localhost:3000
```

**Примечание**: Не коммитьте `.env` файлы в Git! Используйте `.env.example` как шаблон.

---

## 🔄 Работа с Submodules

### Инициализация при первом клонировании

```bash
# Клонировать с submodules
git clone --recurse-submodules <repo-url>

# Или после обычного клонирования
git submodule update --init --recursive
```

### Обновление submodules

```bash
# Обновить все submodules до последней версии
git submodule update --remote --recursive

# Или через Makefile
make submodules-update
```

### Внесение изменений в submodule

```bash
# 1. Перейти в директорию submodule
cd prisma  # или bananabot-admin

# 2. Создать ветку и внести изменения
git checkout -b feature/my-changes
# ... внести изменения ...
git add .
git commit -m "feat: my changes"

# 3. Отправить в удаленный репозиторий submodule
git push origin feature/my-changes

# 4. Вернуться в основной проект и обновить ссылку
cd ..
git add prisma  # или bananabot-admin
git commit -m "chore: update prisma submodule"
git push
```

Подробнее: [SUBMODULES_GUIDE.md](SUBMODULES_GUIDE.md)

---

## 🤝 Вклад в проект

Contributions приветствуются! Пожалуйста:

1. Fork проекта
2. Создайте feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit изменения (`git commit -m 'feat: Add some AmazingFeature'`)
4. Push в branch (`git push origin feature/AmazingFeature`)
5. Откройте Pull Request

---

## 📞 Поддержка

Если у вас возникли вопросы или проблемы:

- 📖 Проверьте [документацию](docs/)
- 🐛 Создайте Issue в GitHub
- 💬 Напишите в Telegram

---

## 📄 Лицензия

Этот проект распространяется под лицензией MIT. См. файл `LICENSE` для деталей.

---

## 🙏 Благодарности

- [NestJS](https://nestjs.com/) - за отличный фреймворк
- [grammY](https://grammy.dev/) - за удобный bot фреймворк
- [Next.js](https://nextjs.org/) - за мощный React фреймворк
- [Prisma](https://www.prisma.io/) - за современный ORM
- [Amvera](https://amvera.ru/) - за удобную платформу развертывания

---

<div align="center">

**Сделано с ❤️ для сообщества**

[⬆ Наверх](#-bananabot---telegram-image-generation-bot)

</div>
