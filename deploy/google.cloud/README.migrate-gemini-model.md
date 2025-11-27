# Migration Script: migrate-gemini-model-ssh.sh

## Описание
Скрипт для безопасного применения миграции `geminiModel` к базе данных на Google Cloud VM через SSH.

## Что делает скрипт

1. **Проверяет** текущую структуру таблицы `UserSettings`
2. **Проверяет** существование колонки `geminiModel`
3. **Добавляет** колонку `geminiModel` (если её нет) с дефолтным значением `'gemini-2.5-flash-image'`
4. **Обновляет** существующие записи, где `geminiModel` NULL или пустая строка
5. **Показывает** статистику по моделям и примеры обновленных записей

## Использование

### Базовое использование
```bash
./deploy/google.cloud/migrate-gemini-model-ssh.sh
```

### С кастомными параметрами
```bash
# Указать другой проект
PROJECT_ID=my-project ./deploy/google.cloud/migrate-gemini-model-ssh.sh

# Указать другую VM
INSTANCE_NAME=my-vm ZONE=us-central1-a ./deploy/google.cloud/migrate-gemini-model-ssh.sh

# Указать другие параметры БД
DB_NAME=mydb DB_USER=myuser DB_PASS=mypass ./deploy/google.cloud/migrate-gemini-model-ssh.sh
```

## Переменные окружения

| Переменная | Значение по умолчанию | Описание |
|------------|----------------------|----------|
| `PROJECT_ID` | из `gcloud config` | ID проекта Google Cloud |
| `INSTANCE_NAME` | `bananabot-vm` | Имя VM инстанса |
| `ZONE` | `europe-north1-c` | Зона размещения VM |
| `DB_NAME` | `bananabot` | Имя базы данных |
| `DB_USER` | `bananabot` | Пользователь БД |
| `DB_PASS` | `bananabot_secret` | Пароль БД |

## Безопасность

- Скрипт **запрашивает подтверждение** перед выполнением
- Использует **идемпотентные операции** (можно запускать несколько раз)
- **Проверяет существование** колонки перед добавлением
- **Не удаляет** данные, только добавляет/обновляет

## Вывод скрипта

Скрипт показывает:
- ✅ Текущую структуру таблицы
- ✅ Количество записей в UserSettings
- ✅ Проверку существования колонки
- ✅ Результат добавления колонки
- ✅ Количество обновленных записей
- ✅ Распределение моделей по пользователям
- ✅ Примеры обновленных записей

## Пример вывода

```
=== Применение миграции geminiModel через SSH к Google Cloud VM ===

Project: my-project
Instance: bananabot-vm
Zone: europe-north1-c
Database: bananabot
User: bananabot

Эта миграция добавит поле 'geminiModel' в таблицу UserSettings
и установит значение по умолчанию 'gemini-2.5-flash-image' для всех пользователей

Продолжить? (y/n) y

Подключение к VM через gcloud...

=== Текущая структура таблицы UserSettings ===
...

=== Количество записей в UserSettings ===
 total_settings 
----------------
             42

=== Добавление колонки geminiModel (если не существует) ===
NOTICE:  Колонка geminiModel успешно добавлена

=== Результат: распределение моделей ==='
      geminiModel       | user_count 
------------------------+------------
 gemini-2.5-flash-image |         42

✓ Миграция применена успешно!
Теперь можно деплоить обновленный код бота и админ-панели
```

## Откат (Rollback)

Если нужно откатить миграцию:

```bash
gcloud compute ssh bananabot-vm --zone=europe-north1-c --command="
  cd ~/bananabot && \
  PGPASSWORD='bananabot_secret' sudo docker compose exec -T postgres psql -U bananabot -d bananabot <<'EOF'
ALTER TABLE \"UserSettings\" DROP COLUMN IF EXISTS \"geminiModel\";
EOF
"
```

⚠️ **Внимание**: Откат удалит все пользовательские настройки моделей!

## Troubleshooting

### Ошибка: "Permission denied"
```bash
chmod +x deploy/google.cloud/migrate-gemini-model-ssh.sh
```

### Ошибка: "gcloud: command not found"
Установите [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)

### Ошибка: "Connection refused"
Проверьте, что VM запущена:
```bash
gcloud compute instances list --filter="name=bananabot-vm"
```

### Ошибка: "Database connection failed"
Проверьте, что PostgreSQL контейнер запущен:
```bash
gcloud compute ssh bananabot-vm --zone=europe-north1-c --command="
  sudo docker compose ps
"
```
