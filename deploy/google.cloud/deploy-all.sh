#!/bin/bash
set -e

# Configuration
PROJECT_ID=${PROJECT_ID:-$(gcloud config get-value project)}
INSTANCE_NAME=${INSTANCE_NAME:-"bananabot-vm"}
ZONE=${ZONE:-"europe-north1-c"}
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Default values
DEPLOY_ADMIN=false
DEPLOY_BOT=false
SKIP_BACKUP=false

# Usage function
usage() {
    echo "Usage: $0 [admin|bot|all] [--no-backup]"
    echo "  admin       - Deploy only the Admin panel"
    echo "  bot         - Deploy only the Telegram Bot"
    echo "  all         - Deploy both (default if no target specified)"
    echo "  --no-backup - Skip database backup"
    exit 1
}

# Parse arguments
TARGET_SPECIFIED=false

for arg in "$@"; do
    case $arg in
        admin)
            DEPLOY_ADMIN=true
            TARGET_SPECIFIED=true
            ;;
        bot)
            DEPLOY_BOT=true
            TARGET_SPECIFIED=true
            ;;
        all)
            DEPLOY_ADMIN=true
            DEPLOY_BOT=true
            TARGET_SPECIFIED=true
            ;;
        --no-backup)
            SKIP_BACKUP=true
            ;;
        -h|--help)
            usage
            ;;
        *)
            # Check if it looks like a flag
            if [[ "$arg" == --* ]]; then
                echo "Unknown flag: $arg"
                usage
            fi
            # If no target specified yet and this isn't a flag, assume it's a target
            # But here we stick to explicit matching for safety, or default 'all' if none.
            ;;
    esac
done

# If no target specified, default to ALL
if [ "$TARGET_SPECIFIED" = false ]; then
    DEPLOY_ADMIN=true
    DEPLOY_BOT=true
    echo -e "${YELLOW}No target specified, defaulting to ALL (Admin + Bot)${NC}"
fi

echo -e "${GREEN}Preparing to deploy to $INSTANCE_NAME ($ZONE)...${NC}"
if [ "$DEPLOY_ADMIN" = true ]; then echo "- Target: ADMIN"; fi
if [ "$DEPLOY_BOT" = true ]; then echo "- Target: BOT"; fi

echo -e "\n${YELLOW}=== Deployment Summary ===${NC}"
echo "Project:  $PROJECT_ID"
echo "Instance: $INSTANCE_NAME ($ZONE)"
echo "Branch:   $(git rev-parse --abbrev-ref HEAD)"
echo "Commit:   $(git rev-parse --short HEAD)"

if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}WARNING: You have uncommitted changes! These will be included in the tarball.${NC}"
fi

echo -e "${YELLOW}==========================${NC}"
read -p "Are you sure you want to proceed? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Deployment cancelled.${NC}"
    exit 1
fi



# 0. Database Backup
if [ "$SKIP_BACKUP" = false ]; then
    if [ -f "$SCRIPT_DIR/backup-db.sh" ]; then
        echo -e "\n${GREEN}=== Creating Database Backup ===${NC}"
        "$SCRIPT_DIR/backup-db.sh" "30"
    else
        echo -e "\n${YELLOW}Warning: backup-db.sh not found, skipping backup.${NC}"
    fi
else
    echo -e "\n${YELLOW}Skipping database backup (--no-backup)${NC}"
fi

# 1. Prepare configuration files
FILES_TO_UPLOAD="docker-compose.yml"

if [ -f .env.deploy ]; then
    echo -e "${GREEN}Found .env.deploy, using as .env...${NC}"
    FILES_TO_UPLOAD="$FILES_TO_UPLOAD .env.deploy"
elif [ -f .env ]; then
    echo -e "${GREEN}Found .env, using it...${NC}"
    FILES_TO_UPLOAD="$FILES_TO_UPLOAD .env"
else
    echo -e "${YELLOW}WARNING: No .env or .env.deploy file found!${NC}"
    echo -e "${YELLOW}Deployment might fail if the server lacks environment variables.${NC}"
fi

# 2. Archive Sources
TEMP_FILES=""

if [ "$DEPLOY_ADMIN" = true ]; then
    if [ ! -d "bananabot-admin" ]; then
        echo -e "${RED}ERROR: bananabot-admin submodule not found!${NC}"
        exit 1
    fi
    echo -e "${GREEN}Archiving ADMIN source...${NC}"
    ADMIN_TAR="deploy-admin-$(date +%s).tar.gz"
    tar -czf "$ADMIN_TAR" \
        --exclude='node_modules' \
        --exclude='.next' \
        --exclude='.git' \
        --exclude='dist' \
        --exclude='.turbo' \
        --exclude='.cache' \
        --exclude='*.log' \
        bananabot-admin
    FILES_TO_UPLOAD="$FILES_TO_UPLOAD $ADMIN_TAR"
    TEMP_FILES="$TEMP_FILES $ADMIN_TAR"
fi

if [ "$DEPLOY_BOT" = true ]; then
    echo -e "${GREEN}Archiving BOT source...${NC}"
    BOT_TAR="deploy-bot-$(date +%s).tar.gz"
    tar --exclude='node_modules' \
        --exclude='.git' \
        --exclude='dist' \
        --exclude='.env' \
        --exclude='logs' \
        --exclude='postgres_data' \
        --exclude='redis_data' \
        --exclude='*.log' \
        --exclude='.turbo' \
        --exclude='.cache' \
        -czf "$BOT_TAR" src/ libs/ prisma/ package*.json tsconfig*.json nest-cli.json .gitmodules Dockerfile bananabot-admin/prisma
    FILES_TO_UPLOAD="$FILES_TO_UPLOAD $BOT_TAR"
    TEMP_FILES="$TEMP_FILES $BOT_TAR"
fi

# 3. Upload Files
echo -e "${GREEN}Uploading files to $INSTANCE_NAME...${NC}"
# Add remote script to upload list
FILES_TO_UPLOAD="$FILES_TO_UPLOAD $SCRIPT_DIR/remote-deploy.sh"

# We upload to home dir first
gcloud compute scp $FILES_TO_UPLOAD $INSTANCE_NAME:~/ --zone=$ZONE --quiet

# Cleanup local temp files
if [ ! -z "$TEMP_FILES" ]; then
    rm $TEMP_FILES
fi

# 4. Trigger Remote Deployment
echo -e "${GREEN}Triggering background deployment on VM...${NC}"

REMOTE_ARGS=""
if [ "$DEPLOY_ADMIN" = true ]; then REMOTE_ARGS="$REMOTE_ARGS admin"; fi
if [ "$DEPLOY_BOT" = true ]; then REMOTE_ARGS="$REMOTE_ARGS bot"; fi

# Kill previous deployment if exists
KILL_CMD="
    PID_FILE=~/bananabot/deploy.pid
    if [ -f \"\$PID_FILE\" ]; then
        OLD_PID=\$(cat \"\$PID_FILE\")
        if ps -p \"\$OLD_PID\" > /dev/null; then
            echo \"[INFO] Interrupting previous deployment (PID: \$OLD_PID)...\"
            kill -9 \"\$OLD_PID\" || true
        fi
        rm -f \"\$PID_FILE\"
    fi
"
gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE" --quiet --command="$KILL_CMD"

# Execute remote script in background
# We redirect output to a temp file initially to avoid immediate hangup issues, 
# but the script itself handles logging to deploy-unified.log
EXEC_CMD="nohup bash ~/remote-deploy.sh $REMOTE_ARGS > ~/bananabot/startup.log 2>&1 &"

gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE" --quiet --command="$EXEC_CMD"

echo -e "${GREEN}Deployment triggered in background! Logs available at ~/bananabot/deploy-unified.log${NC}"
