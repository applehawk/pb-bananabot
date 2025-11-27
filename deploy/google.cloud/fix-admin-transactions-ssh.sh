#!/bin/bash
set -e

# Простой скрипт для выполнения SQL через SSH туннель к Google Cloud VM

# Configuration (используем те же переменные, что и в deploy-bot.sh)
PROJECT_ID=${PROJECT_ID:-$(gcloud config get-value project)}
INSTANCE_NAME=${INSTANCE_NAME:-"bananabot-vm"}
ZONE=${ZONE:-"europe-north1-c"}
DB_NAME=${DB_NAME:-"bananabot"}
DB_USER=${DB_USER:-"bananabot"}
DB_PASS=${DB_PASS:-"bananabot_secret"}

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SQL_FILE="$SCRIPT_DIR/../../migrations/fix-admin-adjustment-status.sql"

echo -e "${YELLOW}=== Исправление через SSH туннель к Google Cloud VM ===${NC}\n"
echo -e "Project: ${GREEN}$PROJECT_ID${NC}"
echo -e "Instance: ${GREEN}$INSTANCE_NAME${NC}"
echo -e "Zone: ${GREEN}$ZONE${NC}"
echo -e "Database: ${GREEN}$DB_NAME${NC}"
echo -e "User: ${GREEN}$DB_USER${NC}"

echo -e "\n${YELLOW}Подключение к VM через gcloud...${NC}"

# Выполняем SQL на удаленной VM
gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE" --quiet --command="
    cd ~/bananabot && \
    PGPASSWORD='$DB_PASS' sudo docker compose exec -T postgres psql -U $DB_USER -d $DB_NAME <<'EOF'
-- Проверяем количество транзакций для обновления
SELECT 
    COUNT(*) as total_to_update,
    SUM(\"creditsAdded\") as total_credits
FROM \"Transaction\"
WHERE \"type\" = 'ADMIN_ADJUSTMENT' 
  AND \"status\" = 'PENDING';

-- Обновляем статус
UPDATE \"Transaction\"
SET 
    \"status\" = 'COMPLETED',
    \"completedAt\" = COALESCE(\"completedAt\", \"createdAt\")
WHERE \"type\" = 'ADMIN_ADJUSTMENT' 
  AND \"status\" = 'PENDING';

-- Проверяем результат
SELECT 
    \"type\",
    \"status\",
    COUNT(*) as count,
    SUM(\"creditsAdded\") as total_credits
FROM \"Transaction\"
WHERE \"type\" = 'ADMIN_ADJUSTMENT'
GROUP BY \"type\", \"status\"
ORDER BY \"status\";
EOF
"

echo -e "\n${GREEN}✓ Готово!${NC}"
