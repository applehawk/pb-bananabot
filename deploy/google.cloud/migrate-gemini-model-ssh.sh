#!/bin/bash
set -e

# Скрипт для применения миграции geminiModel через SSH к Google Cloud VM

# Configuration (используем те же переменные, что и в deploy-bot.sh)
PROJECT_ID=${PROJECT_ID:-$(gcloud config get-value project)}
INSTANCE_NAME=${INSTANCE_NAME:-"bananabot-vm"}
ZONE=${ZONE:-"europe-north1-c"}
DB_NAME=${DB_NAME:-"bananabot"}
DB_USER=${DB_USER:-"bananabot"}
DB_PASS=${DB_PASS:-"bananabot_secret"}

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}=== Применение миграции geminiModel через SSH к Google Cloud VM ===${NC}\n"
echo -e "Project: ${GREEN}$PROJECT_ID${NC}"
echo -e "Instance: ${GREEN}$INSTANCE_NAME${NC}"
echo -e "Zone: ${GREEN}$ZONE${NC}"
echo -e "Database: ${GREEN}$DB_NAME${NC}"
echo -e "User: ${GREEN}$DB_USER${NC}"

echo -e "\n${BLUE}Эта миграция добавит поле 'geminiModel' в таблицу UserSettings${NC}"
echo -e "${BLUE}и установит значение по умолчанию 'gemini-2.5-flash-image' для всех пользователей${NC}\n"

read -p "Продолжить? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Отменено${NC}"
    exit 0
fi

echo -e "\n${YELLOW}Подключение к VM через gcloud...${NC}"

# Выполняем SQL на удаленной VM
gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE" --quiet --command="
    cd ~/bananabot && \
    PGPASSWORD='$DB_PASS' sudo docker compose exec -T postgres psql -U $DB_USER -d $DB_NAME <<'EOF'
-- Проверяем текущее состояние таблицы UserSettings
\echo '=== Текущая структура таблицы UserSettings ==='
\d \"UserSettings\"

-- Проверяем количество записей
\echo ''
\echo '=== Количество записей в UserSettings ==='
SELECT COUNT(*) as total_settings FROM \"UserSettings\";

-- Проверяем, существует ли уже колонка geminiModel
\echo ''
\echo '=== Проверка существования колонки geminiModel ==='
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'UserSettings' AND column_name = 'geminiModel';

-- Добавляем колонку, если её нет
\echo ''
\echo '=== Добавление колонки geminiModel (если не существует) ==='
DO \$\$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'UserSettings' AND column_name = 'geminiModel'
    ) THEN
        ALTER TABLE \"UserSettings\" 
        ADD COLUMN \"geminiModel\" TEXT NOT NULL DEFAULT 'gemini-2.5-flash-image';
        RAISE NOTICE 'Колонка geminiModel успешно добавлена';
    ELSE
        RAISE NOTICE 'Колонка geminiModel уже существует';
    END IF;
END \$\$;

-- Обновляем существующие записи (на случай если колонка была, но значения NULL)
\echo ''
\echo '=== Обновление существующих записей ==='
UPDATE \"UserSettings\"
SET \"geminiModel\" = 'gemini-2.5-flash-image'
WHERE \"geminiModel\" IS NULL OR \"geminiModel\" = '';

-- Проверяем результат
\echo ''
\echo '=== Результат: распределение моделей ==='
SELECT 
    \"geminiModel\",
    COUNT(*) as user_count
FROM \"UserSettings\"
GROUP BY \"geminiModel\"
ORDER BY user_count DESC;

-- Показываем несколько примеров
\echo ''
\echo '=== Примеры обновленных записей ==='
SELECT 
    us.\"userId\",
    u.\"username\",
    u.\"firstName\",
    us.\"geminiModel\",
    us.\"updatedAt\"
FROM \"UserSettings\" us
JOIN \"User\" u ON u.\"id\" = us.\"userId\"
ORDER BY us.\"updatedAt\" DESC
LIMIT 5;

\echo ''
\echo '=== Миграция завершена успешно! ==='
EOF
"

echo -e "\n${GREEN}✓ Миграция применена успешно!${NC}"
echo -e "${BLUE}Теперь можно деплоить обновленный код бота и админ-панели${NC}"
