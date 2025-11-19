# 🔐 Руководство по настройке переменных окружения

Это руководство поможет правильно настроить все необходимые `.env` файлы для проекта BananaBot.

## 📋 Содержание

- [Обзор](#обзор)
- [Основной проект (Bot)](#основной-проект-bot)
- [Admin Panel](#admin-panel)
- [Docker окружение](#docker-окружение)
- [Amvera окружение](#amvera-окружение)
- [Безопасность](#безопасность)

---

## Обзор

Проект BananaBot использует несколько `.env` файлов:

```
bananabot/
├── .env                      # Основной проект (Bot)
├── .env.example              # Шаблон для .env
├── bananabot-admin/
│   ├── .env                  # Admin Panel
│   └── .env.example          # Шаблон для admin .env
```

---

## Основной проект (Bot)

### Расположение
`/Users/vladmac/Code/NodeJS/bananabot/.env`

### Создание

```bash
# Скопировать шаблон
cp .env.example .env

# Отредактировать
nano .env
# или
code .env
```

### Обязательные переменные

```bash
# Telegram Bot (ОБЯЗАТЕЛЬНО)
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz    # От @BotFather
ADMIN_CHAT_ID=123456789                           # От @userinfobot

# Database (ОБЯЗАТЕЛЬНО)
DATABASE_URL=postgresql://user:password@localhost:5432/bananabot?schema=public
```

### Полный пример (.env)

```bash
# ============================================================================
# Telegram Bot Configuration
# ============================================================================
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
ADMIN_CHAT_ID=123456789
ADMIN_CHAT_ID_2=987654321                         # Опционально: второй админ

# ============================================================================
# Database Configuration
# ============================================================================
# Для локальной разработки (Docker)
DATABASE_URL=postgresql://bananabot:bananabot_secret@localhost:5432/bananabot?schema=public

# Для локальной разработки (без Docker, если PostgreSQL установлен локально)
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bananabot?schema=public

# Для Amvera (managed PostgreSQL)
# DATABASE_URL=postgresql://username:password@amvera-<username>-cnpg-<project>-rw:5432/bananabot?schema=public

# ============================================================================
# Server Configuration
# ============================================================================
PORT=3000                                         # Порт для бота
NODE_ENV=development                              # development | production
DOMAIN=https://your-domain.com                    # Для webhook (production)

# ============================================================================
# Payment Configuration
# ============================================================================
YOOMONEY_SECRET=your_yoomoney_webhook_secret      # От YooMoney

# ============================================================================
# AI Generation (если используется)
# ============================================================================
IMAGEN_API_KEY=your_ai_api_key                    # Ключ для AI генерации

# ============================================================================
# Optional Configuration
# ============================================================================
TELEGRAM_SECRET_TOKEN=your_random_webhook_secret  # Для безопасности webhook
REDIS_URL=redis://localhost:6379                  # Если используете Redis
```

### Как получить значения

#### BOT_TOKEN
1. Открыть [@BotFather](https://t.me/BotFather) в Telegram
2. Отправить `/newbot`
3. Следовать инструкциям
4. Скопировать токен

#### ADMIN_CHAT_ID
1. Открыть [@userinfobot](https://t.me/userinfobot) в Telegram
2. Отправить `/start`
3. Скопировать ваш ID

#### YOOMONEY_SECRET
1. Зарегистрироваться на [YooMoney](https://yoomoney.ru/)
2. Создать приложение
3. Настроить webhook
4. Получить секретный ключ

---

## Admin Panel

### Расположение
`/Users/vladmac/Code/NodeJS/bananabot/bananabot-admin/.env`

### Создание

```bash
# Перейти в директорию
cd bananabot-admin

# Скопировать шаблон
cp .env.example .env

# Отредактировать
nano .env
```

### Обязательные переменные

```bash
# NextAuth.js (ОБЯЗАТЕЛЬНО)
NEXTAUTH_SECRET=your-random-secret-at-least-32-characters-long
NEXTAUTH_URL=http://localhost:3001

# Database (ОБЯЗАТЕЛЬНО)
DATABASE_URL=postgresql://user:password@localhost:5432/bananabot?schema=public
```

### Полный пример (.env)

```bash
# ============================================================================
# NextAuth.js Configuration
# ============================================================================
# ВАЖНО: Сгенерируйте случайную строку!
# Команда: openssl rand -base64 32
NEXTAUTH_SECRET=Pjy4qBR4xElxudVrlfHCY+Ljb2KAgz2cV+BzY1kwwac=

# NextAuth URL
# Для локальной разработки
NEXTAUTH_URL=http://localhost:3001

# Для production
# NEXTAUTH_URL=https://admin.yourdomain.com

# Для Amvera
# NEXTAUTH_URL=https://your-admin-project.amvera.io

# ============================================================================
# Database Configuration
# ============================================================================
# Для локальной разработки (Docker)
DATABASE_URL=postgresql://bananabot:bananabot_secret@postgres:5432/bananabot?schema=public

# Для локальной разработки (host)
# DATABASE_URL=postgresql://bananabot:bananabot_secret@localhost:5432/bananabot?schema=public

# Для Amvera (та же БД, что у бота)
# DATABASE_URL=postgresql://username:password@amvera-<username>-cnpg-<project>-rw:5432/bananabot?schema=public

# ============================================================================
# Optional Configuration
# ============================================================================
# Bot API URL (если админка общается с ботом)
# BOT_API_URL=http://localhost:3000         # Локально
# BOT_API_URL=http://bot:3000               # Docker
# BOT_API_URL=https://bot.yourdomain.com    # Production

# Next.js Server (обычно переопределяется в docker-compose)
# PORT=3001
# HOSTNAME=0.0.0.0

# Analytics
# NEXT_PUBLIC_GA_ID=GA-XXXXXXXXX

# Sentry (Error tracking)
# SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
# NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
```

### Генерация NEXTAUTH_SECRET

```bash
# Сгенерировать случайную строку (минимум 32 символа)
openssl rand -base64 32

# Или онлайн:
# https://generate-secret.vercel.app/32
```

---

## Docker окружение

При использовании Docker (`make up`), переменные окружения берутся из:

1. **Основной `.env`** (корень проекта)
2. **`docker-compose.yml`** (переопределяет некоторые значения)
3. **`bananabot-admin/.env`** (для админ-панели)

### Пример для Docker

**Корневой `.env`:**
```bash
# Telegram
BOT_TOKEN=your_bot_token
ADMIN_CHAT_ID=your_admin_id

# Database (для docker-compose используются эти переменные)
DATABASE_USER=bananabot
DATABASE_PASSWORD=bananabot_secret
DATABASE_NAME=bananabot
DATABASE_PORT=5432

# Server
BOT_PORT=3000
ADMIN_PORT=3001

# Payment
YOOMONEY_SECRET=your_secret
```

**`bananabot-admin/.env`:**
```bash
# NextAuth
NEXTAUTH_SECRET=your-generated-secret-32-chars
NEXTAUTH_URL=http://localhost:3001

# Database URL (переопределяется в docker-compose.yml)
DATABASE_URL=postgresql://bananabot:bananabot_secret@postgres:5432/bananabot?schema=public
```

### Важно для Docker

- `DATABASE_URL` в docker-compose использует имя сервиса `postgres` вместо `localhost`
- Порты внутри контейнеров: Bot=3000, Admin=3001
- Порты на хосте настраиваются в `.env`: `BOT_PORT` и `ADMIN_PORT`

---

## Amvera окружение

### Bot (Amvera)

Переменные настраиваются в Amvera Dashboard:

```bash
# Node
NODE_ENV=production

# Database (Managed PostgreSQL от Amvera)
DATABASE_URL=postgresql://username:password@amvera-<username>-cnpg-<project>-rw:5432/bananabot?schema=public

# Telegram
BOT_TOKEN=your_bot_token
ADMIN_CHAT_ID=your_admin_id

# Server
PORT=80                                           # Amvera использует порт 80
DOMAIN=https://your-project.amvera.io            # Автоматический домен

# Payment
YOOMONEY_SECRET=your_secret

# Security
TELEGRAM_SECRET_TOKEN=your_random_string
```

### Admin Panel (Amvera)

```bash
# Node
NODE_ENV=production

# Database (та же, что у бота)
DATABASE_URL=postgresql://username:password@amvera-<username>-cnpg-<project>-rw:5432/bananabot?schema=public

# NextAuth
NEXTAUTH_SECRET=your-generated-secret-32-chars
NEXTAUTH_URL=https://your-admin-project.amvera.io

# Server
PORT=80
HOSTNAME=0.0.0.0

# Optional: Bot API
BOT_API_URL=https://your-bot-project.amvera.io
```

### Получение DATABASE_URL на Amvera

1. Создать PostgreSQL в Amvera Dashboard
2. После создания получить параметры:
   - Host: `amvera-<username>-cnpg-<project>-rw`
   - Port: `5432`
   - Database: `bananabot` (или ваше название)
   - Username: ваш username
   - Password: ваш пароль

3. Собрать строку подключения:
```
postgresql://username:password@amvera-<username>-cnpg-<project>-rw:5432/bananabot?schema=public
```

---

## Безопасность

### ⚠️ Что НИКОГДА не делать:

1. **НЕ коммитить `.env` файлы в Git!**
   ```bash
   # Проверить .gitignore
   cat .gitignore | grep .env
   # Должно быть:
   .env
   *.env
   !.env.example
   ```

2. **НЕ использовать одинаковые секреты для разных окружений**
   - Development: один `NEXTAUTH_SECRET`
   - Production: другой `NEXTAUTH_SECRET`

3. **НЕ хранить секреты в открытом виде**
   - Использовать переменные окружения
   - Для production использовать vault-сервисы

### ✅ Best Practices:

1. **Генерировать сильные случайные секреты**
   ```bash
   openssl rand -base64 32
   ```

2. **Использовать разные пароли для БД**
   - Development: простой пароль
   - Production: сложный пароль (минимум 20 символов)

3. **Регулярно обновлять секреты**
   - Менять `TELEGRAM_SECRET_TOKEN` раз в месяц
   - Менять `NEXTAUTH_SECRET` при подозрении на компрометацию

4. **Использовать `.env.example` как шаблон**
   ```bash
   # В .env.example не указывайте реальные значения!
   BOT_TOKEN=your_bot_token_from_botfather
   NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32
   ```

---

## Быстрая проверка

### Checklist для локальной разработки

- [ ] Создан `.env` в корне проекта
- [ ] Установлен `BOT_TOKEN`
- [ ] Установлен `ADMIN_CHAT_ID`
- [ ] Настроен `DATABASE_URL`
- [ ] Создан `bananabot-admin/.env`
- [ ] Сгенерирован и установлен `NEXTAUTH_SECRET`
- [ ] Файлы `.env` добавлены в `.gitignore`

### Команды для проверки

```bash
# Проверить наличие .env файлов
ls -la .env
ls -la bananabot-admin/.env

# Проверить, что .env не в Git
git status --ignored | grep .env

# Проверить переменные (без вывода значений)
grep -q "BOT_TOKEN=" .env && echo "✓ BOT_TOKEN set" || echo "✗ BOT_TOKEN missing"
grep -q "NEXTAUTH_SECRET=" bananabot-admin/.env && echo "✓ NEXTAUTH_SECRET set" || echo "✗ NEXTAUTH_SECRET missing"
```

---

## Troubleshooting

### Проблема: "No .env file found"

**Решение:**
```bash
cp .env.example .env
cp bananabot-admin/.env.example bananabot-admin/.env
# Заполните значения
```

### Проблема: "NEXTAUTH_SECRET is not set"

**Решение:**
```bash
# Сгенерировать секрет
SECRET=$(openssl rand -base64 32)

# Добавить в bananabot-admin/.env
echo "NEXTAUTH_SECRET=$SECRET" >> bananabot-admin/.env
```

### Проблема: Docker не может подключиться к БД

**Причина:** Неправильный `DATABASE_URL` в docker-compose

**Решение:** Использовать имя сервиса `postgres`:
```bash
DATABASE_URL=postgresql://bananabot:bananabot_secret@postgres:5432/bananabot?schema=public
```
А не `localhost`:
```bash
# НЕПРАВИЛЬНО для Docker:
DATABASE_URL=postgresql://bananabot:bananabot_secret@localhost:5432/bananabot?schema=public
```

### Проблема: "Invalid NEXTAUTH_SECRET"

**Причина:** Секрет слишком короткий или не установлен

**Решение:**
```bash
# Минимум 32 символа
openssl rand -base64 32
# Скопировать в bananabot-admin/.env
```

---

## Полезные команды

```bash
# Проверить все .env файлы
find . -name ".env" -not -path "*/node_modules/*"

# Создать все .env из шаблонов
cp .env.example .env
cp bananabot-admin/.env.example bananabot-admin/.env

# Сгенерировать все необходимые секреты
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)"
echo "TELEGRAM_SECRET_TOKEN=$(openssl rand -base64 24)"

# Проверить синтаксис .env (если установлен dotenv-linter)
dotenv-linter .env
dotenv-linter bananabot-admin/.env
```

---

## Шаблоны

### Минимальный .env для быстрого старта

**`.env`:**
```bash
BOT_TOKEN=
ADMIN_CHAT_ID=
DATABASE_URL=postgresql://bananabot:bananabot_secret@localhost:5432/bananabot?schema=public
PORT=3000
NODE_ENV=development
YOOMONEY_SECRET=
```

**`bananabot-admin/.env`:**
```bash
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3001
DATABASE_URL=postgresql://bananabot:bananabot_secret@postgres:5432/bananabot?schema=public
```

---

## Дополнительные ресурсы

- [Документация по настройке](README.md#переменные-окружения)
- [Развертывание на Amvera](AMVERA_DEPLOYMENT.md)
- [Commands Cheatsheet](COMMANDS_CHEATSHEET.md)

---

**Последнее обновление:** 19 ноября 2025
