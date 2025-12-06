#!/bin/bash
set -e

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Parse arguments
SKIP_BACKUP=false
for arg in "$@"; do
    case $arg in
        --no-backup)
            SKIP_BACKUP=true
            shift
            ;;
    esac
done

echo -e "${GREEN}Deploying ALL services (bot + admin)...${NC}"

# Backup database before deploy
if [ "$SKIP_BACKUP" = false ]; then
    echo -e "\n${GREEN}=== Creating Database Backup ===${NC}"
    "$SCRIPT_DIR/backup-db.sh"
else
    echo -e "\n${YELLOW}Skipping database backup (--no-backup)${NC}"
fi
# Deploy admin first (applies migrations)
echo -e "\n${GREEN}=== Deploying ADMIN (with migrations) ===${NC}"
"$SCRIPT_DIR/deploy-admin.sh"

# Deploy bot
echo -e "\n${GREEN}=== Deploying BOT ===${NC}"
"$SCRIPT_DIR/deploy-bot.sh"

echo -e "\n${GREEN}All services deployed!${NC}"
echo -e "${YELLOW}Run ./deploy/google.cloud/check_status.sh to verify${NC}"
