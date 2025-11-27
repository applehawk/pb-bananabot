# Gemini Model Selection Feature

## Описание
Добавлена возможность выбора модели генерации Gemini для каждого пользователя через админ-панель.

## Изменения

### 1. База данных (schema.prisma)
- Добавлено поле `geminiModel` в модель `UserSettings` со значением по умолчанию `'gemini-2.5-flash-image'`

### 2. Миграция базы данных
Создана миграция: `20251125022141_add_gemini_model_to_user_settings`

**Для применения миграции:**

```bash
# Для локальной разработки
npx prisma migrate deploy

# Или через Docker
docker-compose exec bot npx prisma migrate deploy
```

**Обновление существующих записей:**
Миграция автоматически устанавливает значение по умолчанию для всех существующих записей.
Если нужно принудительно обновить, выполните:

```bash
# Локально
psql $DATABASE_URL -f prisma/migrations/update_existing_settings.sql

# Или через Docker
docker-compose exec postgres psql -U $DATABASE_USER -d $DATABASE_NAME -f /path/to/update_existing_settings.sql
```

### 3. API изменения

#### Backend (src/gemini/gemini.service.ts)
- Рефакторинг для поддержки динамического выбора модели
- Добавлен метод `getModel(modelName?: string)` для получения нужной модели
- Обновлены все методы генерации для приема параметра `modelName`

#### Backend (src/generation/generation.service.ts)
- Обновлены вызовы `geminiService` для передачи `settings.geminiModel`

#### Admin API (bananabot-admin/app/api/users/[id]/settings/route.ts)
- Добавлена поддержка поля `geminiModel` в GET и PUT endpoints

### 4. UI изменения (bananabot-admin)

#### Settings Page (app/users/[id]/settings/page.tsx)
- Добавлено поле выбора модели в секцию "Generation Settings"
- Доступные модели:
  - `gemini-2.5-flash-image` (по умолчанию)
  - `gemini-3-pro-image-preview`

## Использование

1. Откройте админ-панель: `http://localhost:3001/users`
2. Выберите пользователя
3. Перейдите в "Settings"
4. В секции "Generation Settings" выберите нужную модель из выпадающего списка
5. Нажмите "Save Changes"

## Доступные модели

- **gemini-2.5-flash-image** - быстрая модель для генерации изображений (по умолчанию)
- **gemini-3-pro-image-preview** - продвинутая модель с улучшенным качеством

## Переменные окружения

Глобальное значение по умолчанию по-прежнему задается через:
```
GEMINI_MODEL='gemini-2.5-flash-image'
```

Это значение используется:
- Для новых пользователей (при создании настроек)
- Как fallback, если в настройках пользователя не указана модель

## Деплой

### Для Google Cloud:

**Вариант 1: Автоматическая миграция через SSH скрипт (рекомендуется)**

```bash
# 1. Примените миграцию к базе данных
./deploy/google.cloud/migrate-gemini-model-ssh.sh

# 2. Деплой обновленного кода
./deploy/google.cloud/deploy-bot.sh
./deploy/google.cloud/deploy-admin.sh
```

**Вариант 2: Ручное применение миграции**

```bash
# 1. Обновите код на сервере
./deploy/google.cloud/deploy-bot.sh

# 2. Примените миграции вручную через SSH
gcloud compute ssh bananabot-vm --zone=europe-north1-c --command="
  cd ~/bananabot && \
  sudo docker compose exec bot npx prisma migrate deploy
"
```

### Для локальной разработки:
```bash
# 1. Примените миграции
npx prisma migrate deploy

# 2. Перезапустите сервисы
make restart
```

## Тестирование

1. Создайте тестового пользователя
2. Установите модель `gemini-3-pro-image-preview` в настройках
3. Сгенерируйте изображение через бота
4. Проверьте логи, что используется правильная модель
