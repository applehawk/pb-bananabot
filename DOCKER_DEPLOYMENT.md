# BananaBot - Docker Deployment Guide

Полное руководство по развертыванию всей экосистемы BananaBot с использованием Docker и docker-compose.

## Архитектура

BananaBot состоит из следующих сервисов, работающих в единой Docker сети `bananabot-network`:

```
┌─────────────────────────────────────────────────────────────┐
│                    bananabot-network                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  PostgreSQL  │  │    Redis     │  │    Nginx     │       │
│  │   :5432      │  │   :6379      │  │   :80/:443   │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                  │               │
│         ├─────────────────┼──────────────────┤               │
│         │                 │                  │               │
│  ┌──────▼─────────┐ ┌────▼──────────┐                       │
│  │  Telegram Bot  │ │ Admin Panel   │                       │
│  │  (NestJS)      │ │ (Next.js)     │                       │
│  │  :3000         │ │ :3001         │                       │
│  └────────────────┘ └───────────────┘                       │
│         │                    │                               │
│         └────────┬───────────┘                               │
│                  │                                           │
│           ┌──────▼────────┐                                  │
│           │ Prisma Schema │                                  │
│           │  (submodule)  │                                  │
│           └───────────────┘                                  │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## Структура проекта

```
bananabot/
├── .gitmodules                 # Git submodules config
├── docker-compose.yml          # Все сервисы
├── Dockerfile                  # Bot Dockerfile
├── .env                        # Environment variables
│
├── prisma/                     # ← Submodule: bananabot-prisma
│   ├── schema.prisma
│   ├── migrations/
│   └── package.json
│
├── bananabot-admin/            # ← Submodule: bananabot-admin
│   ├── Dockerfile
│   ├── app/
│   ├── prisma/                 # ← Submodule: bananabot-prisma
│   └── .env
│
└── src/                        # Bot source code
```

## Предварительные требования

- Docker 20.10+
- Docker Compose 2.0+
- Git with submodules support
- Минимум 2GB RAM
- Минимум 10GB свободного места на диске

## Быстрый старт

### 1. Клонирование репозитория с submodules

```bash
git clone --recurse-submodules git@github.com:applehawk/pb-bananabot.git
cd pb-bananabot
```

Если уже клонировали без `--recurse-submodules`:

```bash
git submodule init
git submodule update --init --recursive
```

### 2. Настройка переменных окружения

Создайте файл `.env` в корне проекта:

```bash
cp .env.example .env
```

Минимальная конфигурация `.env`:

```env
# Database
DATABASE_USER=bananabot
DATABASE_PASSWORD=your_secure_password_here
DATABASE_NAME=bananabot
DATABASE_PORT=5432

# Redis
REDIS_PORT=6379

# Bot
BOT_PORT=3000
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# Admin Panel
ADMIN_PORT=3001

# Node Environment
NODE_ENV=production

# API Keys
OPENAI_API_KEY=your_openai_api_key
YOOMONEY_CLIENT_ID=your_yoomoney_client_id
# ... другие ключи
```

Создайте `.env` для админ-панели:

```bash
cp bananabot-admin/.env.example bananabot-admin/.env
```

### 3. Запуск всех сервисов

```bash
# Сборка и запуск всех контейнеров
docker-compose up -d

# Просмотр логов
docker-compose logs -f

# Просмотр логов конкретного сервиса
docker-compose logs -f bot
docker-compose logs -f admin
docker-compose logs -f postgres
```

### 4. Проверка работоспособности

После запуска проверьте:

- **PostgreSQL:** `docker-compose ps postgres` - должен быть healthy
- **Redis:** `docker-compose ps redis` - должен быть healthy
- **Bot:** http://localhost:3000/health
- **Admin Panel:** http://localhost:3001
- **Admin Health:** http://localhost:3001/api/health

### 5. Применение миграций Prisma

Миграции применяются автоматически при запуске. Для ручного применения:

```bash
# Войти в контейнер бота
docker-compose exec bot sh

# Применить миграции
cd prisma && npx prisma migrate deploy
```

## Работа с сервисами

### Остановка сервисов

```bash
# Остановить все сервисы
docker-compose down

# Остановить с удалением volumes (ВНИМАНИЕ: БД будет удалена!)
docker-compose down -v

# Остановить конкретный сервис
docker-compose stop bot
docker-compose stop admin
```

### Перезапуск сервисов

```bash
# Перезапустить все
docker-compose restart

# Перезапустить конкретный сервис
docker-compose restart bot
docker-compose restart admin
```

### Пересборка образов

```bash
# Пересобрать все образы
docker-compose build --no-cache

# Пересобрать конкретный сервис
docker-compose build --no-cache bot
docker-compose build --no-cache admin
```

### Просмотр логов

```bash
# Все сервисы
docker-compose logs -f

# Конкретный сервис
docker-compose logs -f bot
docker-compose logs -f admin
docker-compose logs -f postgres

# Последние 100 строк
docker-compose logs --tail=100 bot
```

## Работа с базой данных

### Подключение к PostgreSQL

```bash
# Через docker-compose
docker-compose exec postgres psql -U bananabot -d bananabot

# Прямое подключение (если порт проброшен)
psql -h localhost -U bananabot -d bananabot
```

### Бэкап базы данных

```bash
# Создать бэкап
docker-compose exec postgres pg_dump -U bananabot bananabot > backup_$(date +%Y%m%d_%H%M%S).sql

# Или с gzip сжатием
docker-compose exec postgres pg_dump -U bananabot bananabot | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Восстановление из бэкапа

```bash
# Восстановить из бэкапа
cat backup.sql | docker-compose exec -T postgres psql -U bananabot bananabot

# Из сжатого бэкапа
gunzip < backup.sql.gz | docker-compose exec -T postgres psql -U bananabot bananabot
```

## Работа с Prisma

### Применение миграций

```bash
# В контейнере бота
docker-compose exec bot sh -c "cd prisma && npx prisma migrate deploy"
```

### Создание новой миграции (development)

```bash
# Локально (не в контейнере)
cd prisma
npm run migrate:dev --name your_migration_name
```

### Prisma Studio

```bash
cd prisma
npm run studio
```

Откроется на http://localhost:5555

### Обновление Prisma Client

```bash
docker-compose exec bot sh -c "cd prisma && npx prisma generate"
docker-compose restart bot

docker-compose exec admin sh -c "cd prisma && npx prisma generate"
docker-compose restart admin
```

## Production развертывание

### С Nginx (SSL/HTTPS)

Для запуска с Nginx:

```bash
docker-compose --profile production up -d
```

Nginx конфигурация в `nginx.conf`:

```nginx
upstream bot_backend {
    server bot:3000;
}

upstream admin_backend {
    server admin:3001;
}

server {
    listen 80;
    server_name yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # Admin Panel
    location /admin {
        proxy_pass http://admin_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Bot API (if needed)
    location /api {
        proxy_pass http://bot_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Мониторинг

Проверка статуса всех сервисов:

```bash
docker-compose ps
```

Использование ресурсов:

```bash
docker stats
```

### Логирование

Все логи бота сохраняются в `./logs/`:

```bash
ls -la logs/
tail -f logs/application.log
```

## Troubleshooting

### Проблема: Контейнер не запускается

```bash
# Проверить логи
docker-compose logs bot

# Проверить конфигурацию
docker-compose config

# Проверить health check
docker-compose ps
```

### Проблема: База данных недоступна

```bash
# Проверить статус PostgreSQL
docker-compose ps postgres

# Проверить логи
docker-compose logs postgres

# Переподключиться
docker-compose restart postgres
docker-compose restart bot
```

### Проблема: Prisma миграции не применяются

```bash
# Применить миграции вручную
docker-compose exec bot sh -c "cd prisma && npx prisma migrate deploy"

# Проверить статус миграций
docker-compose exec bot sh -c "cd prisma && npx prisma migrate status"
```

### Проблема: Submodules не загрузились

```bash
# Обновить submodules
git submodule update --init --recursive

# Проверить статус
git submodule status

# Перезапустить контейнеры
docker-compose down
docker-compose up -d
```

### Проблема: Out of memory

Увеличьте память для Docker:
- Docker Desktop: Settings → Resources → Memory
- Linux: Измените `/etc/docker/daemon.json`

### Проблема: Порты заняты

```bash
# Проверить какой процесс использует порт
lsof -i :3000
lsof -i :3001
lsof -i :5432

# Изменить порты в .env
BOT_PORT=3010
ADMIN_PORT=3011
DATABASE_PORT=5433
```

## Production Checklist

- [ ] Изменены все дефолтные пароли
- [ ] DATABASE_PASSWORD использует сложный пароль
- [ ] TELEGRAM_BOT_TOKEN настроен корректно
- [ ] Все API ключи добавлены в .env
- [ ] PostgreSQL доступен только из internal network
- [ ] Redis доступен только из internal network
- [ ] Настроен HTTPS через Nginx
- [ ] Настроены регулярные бэкапы БД
- [ ] Health checks работают
- [ ] Логирование настроено
- [ ] Мониторинг настроен (опционально)
- [ ] Firewall правила настроены

## Обновление приложения

```bash
# 1. Получить последние изменения
git pull origin main
git submodule update --remote

# 2. Пересобрать образы
docker-compose build --no-cache

# 3. Остановить старые контейнеры
docker-compose down

# 4. Запустить новые
docker-compose up -d

# 5. Проверить логи
docker-compose logs -f
```

## Ссылки

- **Main Repository:** [applehawk/pb-bananabot](https://github.com/applehawk/pb-bananabot)
- **Admin Panel:** [applehawk/bananabot-admin](https://github.com/applehawk/bananabot-admin)
- **Prisma Schema:** [applehawk/bananabot-prisma](https://github.com/applehawk/bananabot-prisma)

## Поддержка

При возникновении проблем:
1. Проверьте логи: `docker-compose logs -f`
2. Проверьте health checks: `docker-compose ps`
3. Проверьте переменные окружения: `docker-compose config`
