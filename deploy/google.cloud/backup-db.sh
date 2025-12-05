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

# Backup filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="backup_${DB_NAME}_${TIMESTAMP}.sql.gz"
LOCAL_BACKUP_DIR="./backups"

echo -e "${GREEN}=== Database Backup ===${NC}"
echo "Instance: $INSTANCE_NAME"
echo "Database: $DB_NAME"
echo "Backup: $BACKUP_NAME"
echo ""

# Create local backup directory
mkdir -p "$LOCAL_BACKUP_DIR"

# Create backup on VM and download
echo -e "${GREEN}Creating database backup...${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="
    cd ~/bananabot && \
    PGPASSWORD='$DB_PASS' sudo docker compose exec -T postgres \
        pg_dump -U $DB_USER -d $DB_NAME --no-owner --no-acl | gzip > /tmp/$BACKUP_NAME && \
    echo 'Backup created: /tmp/$BACKUP_NAME'
"

echo -e "${GREEN}Downloading backup...${NC}"
gcloud compute scp $INSTANCE_NAME:/tmp/$BACKUP_NAME "$LOCAL_BACKUP_DIR/$BACKUP_NAME" --zone=$ZONE --quiet

# Cleanup remote backup
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="rm -f /tmp/$BACKUP_NAME"

# Show backup info
BACKUP_SIZE=$(ls -lh "$LOCAL_BACKUP_DIR/$BACKUP_NAME" | awk '{print $5}')
echo ""
echo -e "${GREEN}✓ Backup completed successfully!${NC}"
echo -e "  Location: ${YELLOW}$LOCAL_BACKUP_DIR/$BACKUP_NAME${NC}"
echo -e "  Size: ${YELLOW}$BACKUP_SIZE${NC}"

# Keep only last 5 backups
echo ""
echo -e "${GREEN}Cleaning old backups (keeping last 5)...${NC}"
ls -t "$LOCAL_BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | tail -n +6 | xargs -r rm -f
echo -e "Current backups:"
ls -lh "$LOCAL_BACKUP_DIR"/backup_*.sql.gz 2>/dev/null || echo "  (none)"
