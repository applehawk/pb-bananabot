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

LOCAL_BACKUP_DIR="./backups"

# Check for backup file argument or list available
if [ -z "$1" ]; then
    echo -e "${YELLOW}Available backups:${NC}"
    ls -lht "$LOCAL_BACKUP_DIR"/backup_*.sql.gz 2>/dev/null || echo "  No backups found in $LOCAL_BACKUP_DIR"
    echo ""
    echo "Usage: $0 <backup_file.sql.gz>"
    echo "Example: $0 backups/backup_bananabot_20251205_221500.sql.gz"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}Error: Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

BACKUP_NAME=$(basename "$BACKUP_FILE")

echo -e "${RED}=== DATABASE RESTORE ===${NC}"
echo -e "${RED}WARNING: This will REPLACE ALL DATA in database '$DB_NAME'!${NC}"
echo ""
echo "Instance: $INSTANCE_NAME"
echo "Database: $DB_NAME"
echo "Backup: $BACKUP_FILE"
echo ""
read -p "Are you ABSOLUTELY sure? Type 'yes' to confirm: " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo -e "${GREEN}Stopping services...${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="
    cd ~/bananabot && \
    sudo docker compose stop bot admin
"

echo -e "${GREEN}Uploading backup...${NC}"
gcloud compute scp "$BACKUP_FILE" $INSTANCE_NAME:/tmp/$BACKUP_NAME --zone=$ZONE --quiet

echo -e "${GREEN}Restoring database...${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="
    cd ~/bananabot && \
    
    # Drop and recreate database
    PGPASSWORD='$DB_PASS' sudo docker compose exec -T postgres \
        psql -U $DB_USER -d postgres -c 'DROP DATABASE IF EXISTS $DB_NAME;' && \
    PGPASSWORD='$DB_PASS' sudo docker compose exec -T postgres \
        psql -U $DB_USER -d postgres -c 'CREATE DATABASE $DB_NAME;' && \
    
    # Restore from backup
    gunzip -c /tmp/$BACKUP_NAME | PGPASSWORD='$DB_PASS' sudo docker compose exec -T postgres \
        psql -U $DB_USER -d $DB_NAME && \
    
    rm -f /tmp/$BACKUP_NAME && \
    echo 'Database restored successfully!'
"

echo -e "${GREEN}Starting services...${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="
    cd ~/bananabot && \
    sudo docker compose up -d bot admin
"

echo ""
echo -e "${GREEN}✓ Restore completed!${NC}"
echo -e "${YELLOW}Run ./deploy/google.cloud/check_status.sh to verify services${NC}"
