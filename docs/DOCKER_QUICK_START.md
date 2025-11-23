# 🐳 Docker Quick Start - BananaBot

Быстрое руководство по запуску BananaBot с использованием Docker Compose.

## 📋 Предварительные требования

- Docker Desktop установлен и запущен
- Git с поддержкой submodules
- Минимум 4GB RAM для Docker

## 🚀 Быстрый старт (5 минут)

### 1. Клонирование репозитория с submodules

```bash
# Клонировать с submodules
git clone --recurse-submodules <repo-url>
cd bananabot

# Если уже клонировали без submodules:
git submodule update --init --recursive
```

### 2. Создание .env файлов

#### Основной .env (корень проекта)

```bash
# Скопировать шаблон
cp .env.example .env

# Минимально необходимые переменные:
nano .env
```

Добавьте:
```bash
BOT_TOKEN=<ваш токен от @BotFather>
ADMIN_CHAT_ID=<ваш Telegram ID от @userinfobot>
DATABASE_URL=postgresql://bananabot:bananabot_secret@localhost:5432/bananabot?schema=public
YOOMONEY_SECRET=<ваш секрет от YooMoney>
```

#### Admin Panel .env

```bash
# Создать .env для админ-панели
cp bananabot-admin/.env.example bananabot-admin/.env

# Сгенерировать NEXTAUTH_SECRET
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)" >> bananabot-admin/.env
```

Или вручную отредактировать `bananabot-admin/.env`:
```bash
NEXTAUTH_SECRET=<сгенерированный секрет>
NEXTAUTH_URL=http://localhost:3001
DATABASE_URL=postgresql://bananabot:bananabot_secret@postgres:5432/bananabot?schema=public
```

### 3. Запуск всех сервисов

```bash
# Запустить все сервисы (PostgreSQL, Redis, Bot, Admin)
make up

# Или напрямую через docker-compose:
docker-compose up -d
```

При первом запуске это займет 3-5 минут (сборка Docker образов).

### 4. Проверка статуса

```bash
# Проверить статус сервисов
make ps

# Просмотр логов
make logs

# Логи только бота
docker-compose logs -f bot

# Логи только админ-панели
docker-compose logs -f admin
```

### 5. Доступ к сервисам

После успешного запуска:

- **Bot Health Check**: http://localhost:3000/health
- **Admin Panel**: http://localhost:3001
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## ✅ Проверка работоспособности

### Проверка Bot

```bash
# Health check
curl http://localhost:3000/health

# Ожидаемый ответ:
# {"status":"ok","timestamp":"..."}
```

### Проверка Admin Panel

```bash
# Health check
curl http://localhost:3001/api/health

# Или откройте в браузере:
open http://localhost:3001
```

### Проверка Telegram Bot

1. Откройте Telegram
2. Найдите вашего бота по username
3. Отправьте `/start`
4. Бот должен ответить

## 🛠 Частые проблемы и решения

### Проблема: "No .env file found"

**Решение:**
```bash
# Создать .env файлы
cp .env.example .env
cp bananabot-admin/.env.example bananabot-admin/.env

# Заполнить обязательные переменные
nano .env
nano bananabot-admin/.env
```

### Проблема: "Submodules not initialized"

**Решение:**
```bash
git submodule update --init --recursive
```

### Проблема: "Port already in use"

**Причина:** Порты 3000, 3001, 5432 или 6379 уже заняты

**Решение:**
```bash
# Остановить существующие контейнеры
docker-compose down

# Или изменить порты в .env:
echo "BOT_PORT=3010" >> .env
echo "ADMIN_PORT=3011" >> .env
echo "DATABASE_PORT=5433" >> .env
```

### Проблема: "Build failed"

**Решение:**
```bash
# Очистить Docker кеш и пересобрать
docker-compose down
docker system prune -a -f
make up
```

### Проблема: "Prisma Client not generated"

**Причина:** Prisma Client не сгенерирован

**Решение:**
```bash
# Сгенерировать Prisma Client
make db-generate

# Или вручную:
cd prisma && npx prisma generate && cd ..

# Пересобрать Docker
make up
```

### Проблема: "Database connection failed"

**Решение:**
```bash
# Проверить что PostgreSQL запущен
docker-compose ps postgres

# Проверить логи PostgreSQL
docker-compose logs postgres

# Пересоздать PostgreSQL
docker-compose stop postgres
docker-compose rm -f postgres
docker-compose up -d postgres
```

## 📝 Полезные команды

### Управление сервисами

```bash
# Запустить все сервисы
make up

# Остановить все сервисы
make down

# Перезапустить все сервисы
make docker-restart

# Остановить и удалить все (включая volumes)
docker-compose down -v
```

### Просмотр логов

```bash
# Все логи
make logs

# Логи конкретного сервиса
docker-compose logs -f bot
docker-compose logs -f admin
docker-compose logs -f postgres
docker-compose logs -f redis

# Последние 100 строк
docker-compose logs --tail=100 bot
```

### Работа с БД

```bash
# Prisma Studio (GUI для БД)
make db-studio

# Применить миграции
make db-migrate

# Подключиться к PostgreSQL
docker-compose exec postgres psql -U bananabot -d bananabot
```

### Перезапуск отдельных сервисов

```bash
# Перезапустить только бота
docker-compose restart bot

# Перезапустить только админ-панель
docker-compose restart admin

# Пересобрать и перезапустить бота
docker-compose up -d --build bot
```

### Очистка

```bash
# Остановить все
make down

# Удалить неиспользуемые образы
docker system prune -a

# Удалить volumes (⚠️ удалит данные БД!)
docker-compose down -v

# Полная очистка
docker-compose down -v
docker system prune -a -f
```

## 🔧 Настройка webhook (для production)

После развертывания настройте webhook для Telegram:

```bash
# Установить webhook
make webhook-set

# Проверить webhook
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"

# Удалить webhook (для переключения на polling)
make webhook-delete
```

## 📊 Мониторинг

### Использование ресурсов

```bash
# Статистика использования ресурсов
docker stats

# Статистика конкретного контейнера
docker stats bananabot-bot
```

### Health Checks

```bash
# Проверить здоровье всех сервисов
docker-compose ps

# Health check бота
curl http://localhost:3000/health

# Health check админки
curl http://localhost:3001/api/health
```

## 🎯 Следующие шаги

После успешного запуска:

1. **Протестировать бота** - отправить `/start` в Telegram
2. **Открыть админ-панель** - http://localhost:3001
3. **Настроить YooMoney** - если используете платежи
4. **Настроить webhook** - для production
5. **Ознакомиться с документацией** - [README.md](README.md)

## 📚 Дополнительные ресурсы

- [Полная документация](README.md)
- [Настройка переменных окружения](ENV_SETUP_GUIDE.md)
- [Развертывание на Amvera](AMVERA_DEPLOYMENT.md)
- [Commands Cheatsheet](COMMANDS_CHEATSHEET.md)
- [Примеры Makefile](.makefile-examples.md)

## 🆘 Получение помощи

Если проблемы сохраняются:

1. Проверьте логи: `make logs`
2. Проверьте статус: `make ps`
3. Проверьте `.env` файлы
4. Создайте Issue в GitHub с логами

---

**Дата создания:** 19 ноября 2025
**Версия:** 1.0.0
