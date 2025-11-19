# BananaBot - Quick Start Guide

Быстрое руководство по запуску и разработке BananaBot.

## Установка и запуск

### Первый запуск

```bash
# 1. Клонировать с submodules
git clone --recurse-submodules git@github.com:applehawk/pb-bananabot.git
cd pb-bananabot

# 2. Настроить окружение
cp .env.example .env
# Отредактируйте .env файл

# 3. Установить зависимости
make setup

# 4. Запустить через Docker (рекомендуется)
make docker-up

# Или запустить локально
make dev
```

### Проверка

- Bot: http://localhost:3000/health
- Admin: http://localhost:3001
- PostgreSQL: localhost:5432
- Redis: localhost:6379

## Основные команды

### Разработка бота

```bash
# Запустить бот в dev режиме
make dev

# Собрать проект
make build

# Запустить в production
make start

# Остановить бот
make stop

# Перезапустить
make restart
```

### Разработка админ-панели

```bash
# Установить зависимости админки
make admin-install

# Запустить админку локально (dev mode)
make admin-dev

# Собрать для production
make admin-build

# Запустить админку в Docker
make admin-prod

# Остановить Docker контейнер админки
make admin-stop
```

### Docker команды

```bash
# Запустить все сервисы
make docker-up

# Остановить все сервисы
make docker-down

# Перезапустить сервисы
make docker-restart

# Показать логи
make docker-logs

# Пересобрать образы
make docker-build

# Полный deploy (обновить submodules + собрать + запустить)
make deploy
```

### Работа с Submodules

```bash
# Обновить submodules до последних версий
make submodules-update

# Проверить статус submodules
make submodules-status

# Pull изменения в submodules
make submodules-pull
```

## Редактирование Submodules

### Изменить Prisma Schema

```bash
# 1. Войти в директорию
cd prisma

# 2. Отредактировать schema
vim schema.prisma

# 3. Создать миграцию
npm run migrate:dev --name add_field

# 4. Закоммитить и запушить
git add .
git commit -m "feat: Add new field"
git push origin main

# 5. Вернуться и обновить reference
cd ..
git add prisma
git commit -m "chore: Update prisma submodule"
git push origin imggenbot
```

### Изменить Admin Panel

```bash
# 1. Войти в директорию
cd bananabot-admin

# 2. Внести изменения
vim app/page.tsx

# 3. Закоммитить и запушить
git add .
git commit -m "feat: Update UI"
git push origin main

# 4. Вернуться и обновить reference
cd ..
git add bananabot-admin
git commit -m "chore: Update admin submodule"
git push origin imggenbot
```

## Структура проекта

```
bananabot/
├── Makefile                    # Команды для управления
├── docker-compose.yml          # Docker конфигурация
├── .env                        # Переменные окружения
│
├── prisma/                     # Git submodule (Prisma schema)
│   ├── schema.prisma
│   └── migrations/
│
├── bananabot-admin/            # Git submodule (Admin panel)
│   ├── app/
│   ├── prisma/                 # Nested submodule
│   └── Dockerfile
│
└── src/                        # Код бота
    └── main.ts
```

## Полезные ссылки

- 📖 [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) - Подробное руководство по Docker
- 📖 [SUBMODULES_GUIDE.md](SUBMODULES_GUIDE.md) - Работа с Git Submodules
- 📖 [README.md](README.md) - Основная документация

## Частые проблемы

### Submodules не загрузились

```bash
git submodule update --init --recursive
# Или
make submodules-update
```

### Docker контейнеры не запускаются

```bash
# Проверить логи
make docker-logs

# Пересобрать образы
make docker-build
make docker-up
```

### База данных недоступна

```bash
# Проверить статус PostgreSQL
docker-compose ps postgres

# Применить миграции вручную
docker-compose exec bot sh -c "cd prisma && npx prisma migrate deploy"
```

### Порт занят

Измените порты в `.env`:
```env
BOT_PORT=3010
ADMIN_PORT=3011
DATABASE_PORT=5433
```

## Команды быстрого доступа

```bash
# Посмотреть все доступные команды
make help

# Полная очистка и переустановка
make clean-all
make setup
make docker-up

# Быстрый рестарт при разработке
make restart

# Проверить состояние всех сервисов
docker-compose ps
```

## Что дальше?

1. Настройте переменные окружения в `.env`
2. Запустите `make docker-up`
3. Откройте http://localhost:3001 для админ-панели
4. Начните разработку с `make dev`
5. Изучите [SUBMODULES_GUIDE.md](SUBMODULES_GUIDE.md) для работы с submodules

Удачной разработки! 🚀
