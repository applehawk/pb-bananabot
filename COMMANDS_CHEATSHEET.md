# 🚀 BananaBot - Commands Cheatsheet

Краткая шпаргалка по всем доступным командам проекта.

---

## 📋 Основные команды

| Команда | Описание |
|---------|----------|
| `make help` | Показать все доступные команды |
| `make setup` | Полная настройка окружения (submodules + deps) |
| `make setup-db` | Настройка + инициализация БД |
| `make deploy` | Полное развертывание (Docker) |

---

## 🐳 Docker команды

### Полные имена

| Команда | Описание |
|---------|----------|
| `make docker-up` | Запустить все сервисы |
| `make docker-down` | Остановить все сервисы |
| `make docker-restart` | Перезапустить все сервисы |
| `make docker-logs` | Показать логи |
| `make docker-ps` | Статус сервисов |
| `make docker-build` | Пересобрать образы |

### Короткие алиасы

| Команда | Эквивалент |
|---------|------------|
| `make up` | `make docker-up` |
| `make down` | `make docker-down` |
| `make logs` | `make docker-logs` |
| `make ps` | `make docker-ps` |

---

## 💻 Разработка

### Бот

| Команда | Описание |
|---------|----------|
| `make dev` | Запуск в dev режиме (hot reload) |
| `make build` | Сборка для production |
| `make start` | Запуск в production режиме |
| `make stop` | Остановить бота |
| `make restart` | Перезапуск бота |

### Admin Panel

| Команда | Описание |
|---------|----------|
| `make admin-install` | Установить зависимости |
| `make admin-dev` | Dev режим (localhost:3001) |
| `make admin-build` | Сборка для production |
| `make admin-prod` | Запуск в Docker |
| `make admin-stop` | Остановить в Docker |

---

## 🗄️ База данных

| Команда | Описание |
|---------|----------|
| `make db-generate` | Генерация Prisma Client |
| `make db-migrate` | Создать и применить миграцию |
| `make db-studio` | Открыть Prisma Studio GUI |
| `make db-push` | Push схемы (без миграции) |
| `make db-reset` | ⚠️ Сброс БД (удалит данные) |

### npm команды

| Команда | Описание |
|---------|----------|
| `npm run prisma:generate` | То же что `make db-generate` |
| `npm run prisma:migrate` | То же что `make db-migrate` |
| `npm run prisma:studio` | То же что `make db-studio` |

---

## 📦 Submodules

| Команда | Описание |
|---------|----------|
| `make submodules-init` | Инициализировать submodules |
| `make submodules-update` | Обновить до последних коммитов |
| `make submodules-pull` | Pull изменений |
| `make submodules-status` | Показать статус |

### Git команды

| Команда | Описание |
|---------|----------|
| `git submodule update --init --recursive` | Инициализация |
| `git submodule update --remote --recursive` | Обновление |
| `git submodule status` | Статус |
| `git submodule foreach git pull origin main` | Pull в каждом |

---

## 🔗 Webhook (Telegram)

| Команда | Описание |
|---------|----------|
| `make webhook-set` | Установить webhook |
| `make webhook-delete` | Удалить webhook |

### npm команды

| Команда | Описание |
|---------|----------|
| `npm run webhook:set` | То же что `make webhook-set` |
| `npm run webhook:delete` | То же что `make webhook-delete` |

### Ручная установка webhook

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-domain.com/webhook"}'
```

### Проверка webhook

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

---

## 🧹 Очистка

| Команда | Описание |
|---------|----------|
| `make clean` | Удалить build, кеш, логи |
| `make clean-all` | Полная очистка (+ node_modules) |
| `make clean-build` | Только build артефакты |
| `make clean-deps` | Только node_modules |
| `make clean-cache` | Только кеш файлы |
| `make fresh` | clean-all + install + build |

---

## 🔧 npm команды

### Основные

| Команда | Описание |
|---------|----------|
| `npm install` | Установить зависимости |
| `npm run build` | Собрать проект |
| `npm run start:dev` | Dev режим (polling) |
| `npm run start:prod` | Production режим (webhook) |
| `npm run lint` | Проверка кода |
| `npm test` | Запуск тестов |

### Admin Panel (pnpm)

| Команда | Описание |
|---------|----------|
| `pnpm install` | Установить зависимости |
| `pnpm run dev` | Dev режим |
| `pnpm run build` | Сборка |
| `pnpm start` | Production режим |

---

## 🐳 Docker Compose команды

### Базовые

| Команда | Описание |
|---------|----------|
| `docker-compose up -d` | Запустить в фоне |
| `docker-compose down` | Остановить |
| `docker-compose ps` | Статус сервисов |
| `docker-compose logs -f` | Логи (все) |
| `docker-compose logs -f bot` | Логи бота |
| `docker-compose logs -f admin` | Логи админ-панели |
| `docker-compose restart` | Перезапуск |
| `docker-compose build` | Пересборка |

### Управление отдельными сервисами

| Команда | Описание |
|---------|----------|
| `docker-compose up -d postgres` | Только БД |
| `docker-compose up -d bot` | Только бот |
| `docker-compose up -d admin` | Только админ-панель |
| `docker-compose stop bot` | Остановить бота |
| `docker-compose restart admin` | Перезапустить админку |

### Очистка

| Команда | Описание |
|---------|----------|
| `docker-compose down -v` | Остановить + удалить volumes |
| `docker system prune -a` | ⚠️ Удалить все неиспользуемые образы |
| `docker volume prune` | Удалить неиспользуемые volumes |

---

## 📊 Полезные комбинации

### Первый запуск

```bash
git clone --recurse-submodules <repo-url>
cd bananabot
cp .env.example .env
# Отредактировать .env
make setup-db
make up
```

### Локальная разработка

```bash
# Терминал 1: БД
docker-compose up -d postgres redis

# Терминал 2: Бот
make dev

# Терминал 3: Админка
make admin-dev
```

### Обновление проекта

```bash
git pull origin main
make submodules-update
npm install
cd bananabot-admin && pnpm install && cd ..
make db-migrate
make docker-restart
```

### Пересборка с нуля

```bash
make clean-all
make fresh
make up
```

### Отладка

```bash
make logs                    # Все логи
docker-compose logs -f bot   # Только бот
make db-studio              # Проверить БД
make ps                     # Статус сервисов
```

---

## 🌐 Проверка работоспособности

### Health checks

```bash
# Бот
curl http://localhost:3000/health

# Админ-панель
curl http://localhost:3001/api/health

# PostgreSQL
psql $DATABASE_URL -c "SELECT version();"
```

### Webhook

```bash
# Получить информацию
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"

# Удалить webhook (для переключения на polling)
curl "https://api.telegram.org/bot<BOT_TOKEN>/deleteWebhook"
```

---

## 🔑 Переменные окружения

### Основные (Bot)

```bash
BOT_TOKEN=              # От @BotFather
ADMIN_CHAT_ID=          # От @userinfobot
DATABASE_URL=           # PostgreSQL connection string
PORT=3000              # Порт бота
NODE_ENV=development   # development | production
DOMAIN=                # Для webhook (production)
```

### Admin Panel

```bash
DATABASE_URL=          # Та же, что у бота
PORT=3001             # Порт админ-панели
NEXTAUTH_SECRET=      # openssl rand -base64 32
NEXTAUTH_URL=         # http://localhost:3001
```

---

## 📚 Документация

| Файл | Описание |
|------|----------|
| [README.md](README.md) | Основная документация |
| [QUICK_START.md](QUICK_START.md) | Быстрый старт |
| [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) | Docker развертывание |
| [AMVERA_DEPLOYMENT.md](AMVERA_DEPLOYMENT.md) | Развертывание на Amvera |
| [SUBMODULES_GUIDE.md](SUBMODULES_GUIDE.md) | Работа с submodules |
| [.makefile-examples.md](.makefile-examples.md) | Примеры использования Makefile |

---

## 💡 Советы

1. **Всегда используйте `make help`** для просмотра всех команд
2. **Docker алиасы**: `up`, `down`, `logs`, `ps` короче и проще
3. **Submodules**: После `git pull` всегда делайте `make submodules-update`
4. **База данных**: Используйте миграции (`db-migrate`), а не `db-push` в production
5. **Webhook vs Polling**: Для разработки используйте polling (`make dev`), для production - webhook (`make start`)
6. **Prisma Studio**: Удобный GUI для работы с БД (`make db-studio`)
7. **Логи**: `make logs` показывает логи всех сервисов в реальном времени
8. **Очистка**: Если что-то сломалось, попробуйте `make fresh`

---

**Больше примеров**: [.makefile-examples.md](.makefile-examples.md)
