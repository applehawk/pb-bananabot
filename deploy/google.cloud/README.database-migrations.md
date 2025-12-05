# Инструкция: Миграции базы данных для Production

## Обзор

Миграции Prisma расположены в подмодуле `bananabot-admin/prisma/migrations`.
Оба сервиса (Bot и Admin) автоматически применяют миграции при старте контейнера.

---

## Автоматический бэкап

Скрипт `deploy.sh` автоматически создаёт бэкап базы данных перед деплоем.

### Полный деплой с бэкапом

```bash
./deploy/google.cloud/deploy.sh
```

### Деплой без бэкапа (не рекомендуется)

```bash
./deploy/google.cloud/deploy.sh --no-backup
```

### Ручной бэкап

```bash
./deploy/google.cloud/backup-db.sh
```

Бэкапы сохраняются в `./backups/` (последние 5 файлов).

### Восстановление из бэкапа

```bash
# Посмотреть доступные бэкапы
./deploy/google.cloud/restore-db.sh

# Восстановить конкретный бэкап
./deploy/google.cloud/restore-db.sh backups/backup_bananabot_20251205_221500.sql.gz
```

> [!WARNING]
> Восстановление **полностью заменяет** все данные в базе!

---

## Как работают миграции

### Автоматическое применение

При запуске контейнеров выполняется команда `prisma migrate deploy`:

- **Bot** (`Dockerfile`, строка 73):
  ```sh
  CMD ["sh", "-c", "npx prisma migrate deploy --schema=./prisma/schema.prisma && node dist/src/main-grammy.js"]
  ```

- **Admin** (`bananabot-admin/Dockerfile`, строка 79):
  ```sh
  CMD ["sh", "-c", "npx prisma migrate deploy --schema=./prisma/schema.prisma && pnpm start"]
  ```

> [!NOTE]
> Команда `prisma migrate deploy` применяет только **pending** миграции и безопасна для повторного запуска.

---

## Шаги деплоя с миграциями

### 1. Убедитесь, что подмодуль обновлён

```bash
# Обновите подмодуль prisma
git submodule update --init --recursive

# Проверьте, что миграции на месте
ls -la bananabot-admin/prisma/migrations/
```

### 2. Деплой Admin панели (рекомендуется первым)

Admin-панель должна деплоиться первой, так как она содержит свежие миграции:

```bash
./deploy/google.cloud/deploy-admin.sh
```

> [!IMPORTANT]
> Admin выполнит `prisma migrate deploy` при старте и применит все pending миграции.

### 3. Деплой Bot

```bash
./deploy/google.cloud/deploy-bot.sh
```

Bot также выполнит `prisma migrate deploy`, но если Admin уже применил миграции, эта операция будет no-op.

---

## Проверка состояния миграций

### Проверка через SSH

```bash
# Подключение к VM
gcloud compute ssh bananabot-vm --zone=europe-north1-c

# Проверка таблицы миграций в PostgreSQL
cd ~/bananabot && \
PGPASSWORD='bananabot_secret' sudo docker compose exec -T postgres \
  psql -U bananabot -d bananabot -c \
  "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 10;"
```

### Вывод примера

```
                     migration_name                       |         finished_at         
----------------------------------------------------------+-----------------------------
 20251205173453_add_reserved_credits                      | 2025-12-05 17:35:12.123456+00
 20251205172038_rename_gemini_model_id_to_selected_model_id | 2025-12-05 17:20:45.654321+00
 20251205164730_add_settings_fields                       | 2025-12-05 16:48:01.987654+00
```

### Проверка логов контейнера

```bash
gcloud compute ssh bananabot-vm --zone=europe-north1-c --command="
  cd ~/bananabot && sudo docker compose logs bot --tail=50 | grep -i prisma
"
```

---

## Решение проблем

### Проблема: Миграция завершилась с ошибкой (P3009)

Если миграция была прервана:

```bash
gcloud compute ssh bananabot-vm --zone=europe-north1-c --command="
  cd ~/bananabot && \
  PGPASSWORD='bananabot_secret' sudo docker compose exec -T postgres \
  psql -U bananabot -d bananabot -c \"
    SELECT migration_name, finished_at, rolled_back_at 
    FROM _prisma_migrations 
    WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL;
  \"
"
```

#### Вариант 1: Пометить миграцию как applied (если изменения уже применены вручную)

```bash
gcloud compute ssh bananabot-vm --zone=europe-north1-c --command="
  cd ~/bananabot && \
  sudo docker compose exec -T bot npx prisma migrate resolve \
    --schema=./prisma/schema.prisma \
    --applied '20251205173453_add_reserved_credits'
"
```

#### Вариант 2: Откатить failed миграцию

```bash
gcloud compute ssh bananabot-vm --zone=europe-north1-c --command="
  cd ~/bananabot && \
  sudo docker compose exec -T bot npx prisma migrate resolve \
    --schema=./prisma/schema.prisma \
    --rolled-back '20251205173453_add_reserved_credits'
"
```

### Проблема: Контейнер не стартует из-за миграции

Проверьте логи:

```bash
gcloud compute ssh bananabot-vm --zone=europe-north1-c --command="
  cd ~/bananabot && sudo docker compose logs bot --tail=100
"
```

Запустите миграцию вручную:

```bash
gcloud compute ssh bananabot-vm --zone=europe-north1-c --command="
  cd ~/bananabot && \
  sudo docker compose run --rm bot npx prisma migrate deploy --schema=./prisma/schema.prisma
"
```

### Проблема: Несоответствие схемы (Drift detected)

Проверьте drift:

```bash
gcloud compute ssh bananabot-vm --zone=europe-north1-c --command="
  cd ~/bananabot && \
  sudo docker compose run --rm bot npx prisma migrate diff \
    --from-schema-datamodel ./prisma/schema.prisma \
    --to-schema-datasource ./prisma/schema.prisma
"
```

---

## Применение миграций вручную (без перезапуска контейнеров)

Если нужно применить миграции без рестарта сервисов:

```bash
gcloud compute ssh bananabot-vm --zone=europe-north1-c --command="
  cd ~/bananabot && \
  sudo docker compose run --rm --no-deps bot npx prisma migrate deploy --schema=./prisma/schema.prisma
"
```

---

## Рекомендации

> [!TIP]
> **Best Practices:**
> 1. Всегда деплойте **Admin первым** — он применит миграции
> 2. Проверяйте статус миграций после деплоя через `check_status.sh`
> 3. Храните backup базы перед major миграциями

> [!WARNING]
> **Не делайте:**
> - Не используйте `prisma migrate dev` на production
> - Не редактируйте migration.sql файлы после применения
> - Не удаляйте миграции из папки migrations/

---

## Текущие миграции

| Миграция | Дата | Описание |
|----------|------|----------|
| `20251116001650_init` | 16.11.2025 | Начальная схема |
| `20251116141332_add_transaction_package_relation` | 16.11.2025 | Связь транзакций с пакетами |
| `20251125022141_add_gemini_model_to_user_settings` | 25.11.2025 | Добавление выбора модели |
| `20251204151500_add_universal_tariff_schema` | 04.12.2025 | Универсальная схема тарифов |
| `20251204205747_add_input_image_tokens` | 04.12.2025 | Токены входного изображения |
| `20251205162602_add_token_costs` | 05.12.2025 | Стоимость токенов |
| `20251205164730_add_settings_fields` | 05.12.2025 | Дополнительные поля настроек |
| `20251205172038_rename_gemini_model_id_to_selected_model_id` | 05.12.2025 | Переименование поля модели |
| `20251205173453_add_reserved_credits` | 05.12.2025 | Зарезервированные кредиты |

---

## Quick Reference

```bash
# Полный деплой с миграциями
./deploy/google.cloud/deploy-admin.sh && ./deploy/google.cloud/deploy-bot.sh

# Проверка статуса
./deploy/google.cloud/check_status.sh

# Проверка миграций
gcloud compute ssh bananabot-vm --zone=europe-north1-c --command="
  cd ~/bananabot && \
  PGPASSWORD='bananabot_secret' sudo docker compose exec -T postgres \
  psql -U bananabot -d bananabot -c 'SELECT * FROM _prisma_migrations ORDER BY finished_at DESC;'
"
```
