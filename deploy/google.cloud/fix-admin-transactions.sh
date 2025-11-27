#!/bin/bash
set -e

# Скрипт для исправления статуса ADMIN_ADJUSTMENT транзакций в Google Cloud PostgreSQL

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SQL_FILE="$SCRIPT_DIR/../../migrations/fix-admin-adjustment-status.sql"

echo -e "${YELLOW}=== Исправление статуса ADMIN_ADJUSTMENT транзакций ===${NC}\n"

# Проверяем наличие SQL файла
if [ ! -f "$SQL_FILE" ]; then
    echo -e "${RED}Ошибка: SQL файл не найден: $SQL_FILE${NC}"
    exit 1
fi

# Запрашиваем параметры подключения
echo -e "${YELLOW}Введите параметры подключения к Google Cloud PostgreSQL:${NC}"
read -p "Host (например, 10.x.x.x или внешний IP): " DB_HOST
read -p "Port (по умолчанию 5432): " DB_PORT
DB_PORT=${DB_PORT:-5432}
read -p "Database name (по умолчанию bananabot): " DB_NAME
DB_NAME=${DB_NAME:-bananabot}
read -p "Username (по умолчанию bananabot): " DB_USER
DB_USER=${DB_USER:-bananabot}
read -sp "Password: " DB_PASSWORD
echo

# Формируем DATABASE_URL
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public"

echo -e "\n${YELLOW}Подключение к базе данных...${NC}"

# Проверяем подключение
if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${RED}Ошибка: Не удалось подключиться к базе данных${NC}"
    echo -e "${YELLOW}Убедитесь, что:${NC}"
    echo "  1. PostgreSQL доступен по указанному адресу"
    echo "  2. Firewall правила разрешают подключение"
    echo "  3. Учетные данные верны"
    exit 1
fi

echo -e "${GREEN}✓ Подключение успешно${NC}\n"

# Выполняем SQL скрипт
echo -e "${YELLOW}Выполнение SQL скрипта...${NC}\n"
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SQL_FILE"

echo -e "\n${GREEN}✓ Скрипт выполнен успешно!${NC}"
echo -e "${GREEN}Все транзакции типа ADMIN_ADJUSTMENT теперь имеют статус COMPLETED${NC}"
