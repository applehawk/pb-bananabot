#!/bin/bash
set -e

# Configuration
PROJECT_ID=${PROJECT_ID:-$(gcloud config get-value project)}
INSTANCE_NAME=${INSTANCE_NAME:-"bananabot-vm"}
ZONE=${ZONE:-"europe-north1-c"}
DB_NAME=${DB_NAME:-"bananabot"}
DB_USER=${DB_USER:-"bananabot"}
DB_PASS=${DB_PASS:-"bananabot_secret"}

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check argument
if [ -z "$1" ]; then
    echo "Usage: $0 <path_to_backup_file.sql.gz>"
    echo "Example: $0 ./backups/backup_bananabot_20251209_141423.sql.gz"
    exit 1
fi

LOCAL_BACKUP_PATH="$1"
FILENAME=$(basename "$LOCAL_BACKUP_PATH")

if [ ! -f "$LOCAL_BACKUP_PATH" ]; then
    echo -e "${RED}Error: File '$LOCAL_BACKUP_PATH' not found!${NC}"
    exit 1
fi

echo -e "${GREEN}=== Database Restore ===${NC}"
echo "Instance: $INSTANCE_NAME"
echo "Database: $DB_NAME"
echo "Backup File: $LOCAL_BACKUP_PATH"
echo ""
echo -e "${RED}⚠️  WARNING: This will OVERWRITE the existing database '$DB_NAME' on the VM!${NC}"
echo -e "${YELLOW}Are you sure you want to proceed? [y/N]${NC}"
read -r -p "" response
if [[ ! "$response" =~ ^[yY]$ ]]; then
    echo "Restore cancelled."
    exit 1
fi

# 1. Upload backup to VM
echo -e "\n${GREEN}Uploading backup to VM...${NC}"
gcloud compute scp "$LOCAL_BACKUP_PATH" $INSTANCE_NAME:/tmp/$FILENAME --zone=$ZONE --quiet

# 2. Restore Database
echo -e "${GREEN}Restoring database (this may take a while)...${NC}"

# Remote script to drop and restore
# - We terminate connections to the DB first
# - We drop and recreate the DB to ensure a clean slate
# - We gunzip and pipe the SQL into psql
RESTORE_SCRIPT="
    echo 'Terminating existing connections...'
    PGPASSWORD='$DB_PASS' sudo docker compose exec -T postgres psql -U $DB_USER -d postgres -c \"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();\" >/dev/null 2>&1 || true

    echo 'Recreating database $DB_NAME...'
    PGPASSWORD='$DB_PASS' sudo docker compose exec -T postgres psql -U $DB_USER -d postgres -c \"DROP DATABASE IF EXISTS $DB_NAME;\"
    PGPASSWORD='$DB_PASS' sudo docker compose exec -T postgres psql -U $DB_USER -d postgres -c \"CREATE DATABASE $DB_NAME;\"

    echo 'Importing data...'
    zcat /tmp/$FILENAME | PGPASSWORD='$DB_PASS' sudo docker compose exec -T postgres psql -U $DB_USER -d $DB_NAME 
    
    echo 'Cleaning up...'
    rm /tmp/$FILENAME
"

gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="$RESTORE_SCRIPT"

echo -e "\n${GREEN}✓ Database restore completed successfully!${NC}"
