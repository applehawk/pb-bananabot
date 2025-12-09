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
        -czf "$BOT_TAR" - src/ libs/ prisma/ package*.json tsconfig*.json nest-cli.json .gitmodules Dockerfile bananabot-admin/prisma
    FILES_TO_UPLOAD="$FILES_TO_UPLOAD $BOT_TAR"
    TEMP_FILES="$TEMP_FILES $BOT_TAR"
fi

# 3. Upload Files
echo -e "${GREEN}Uploading files to $INSTANCE_NAME...${NC}"
# We upload to home dir first
gcloud compute scp $FILES_TO_UPLOAD $INSTANCE_NAME:~/ --zone=$ZONE --quiet

# Cleanup local temp files
if [ ! -z "$TEMP_FILES" ]; then
    rm $TEMP_FILES
fi

# 4. Trigger Remote Deployment
echo -e "${GREEN}Triggering background deployment on VM...${NC}"

# Construct the remote script
REMOTE_SCRIPT="
    # Kill previous deployment if exists
    PID_FILE=~/bananabot/deploy.pid
    if [ -f \"\$PID_FILE\" ]; then
        OLD_PID=\$(cat \"\$PID_FILE\")
        if ps -p \"\$OLD_PID\" > /dev/null; then
            echo \"[INFO] Interrupting previous deployment (PID: \$OLD_PID)...\"
            kill -9 \"\$OLD_PID\" || true
        fi
        rm -f \"\$PID_FILE\"
    fi



    nohup bash -c '
        # Save PID for next run
        echo \$\$ > ~/bananabot/deploy.pid
        trap \"rm -f ~/bananabot/deploy.pid\" EXIT

        set -e
        mkdir -p ~/bananabot
        cd ~/bananabot
        
        LOG_FILE=\"deploy-unified.log\"
        echo \"[Start] Deployment started at \$(date)\" > \$LOG_FILE

        # 🛑 Additional Check: Prune dangling containers/builders
        echo \"Checking and removing dangling containers...\" >> \$LOG_FILE
        sudo docker container prune -f >> \$LOG_FILE 2>&1
        sudo docker builder prune -f >> \$LOG_FILE 2>&1
        echo \"Cleanup complete.\" >> \$LOG_FILE

        # Handle configuration files
        if [ -f ~/.env.deploy ]; then
            mv ~/.env.deploy .env
            echo \"Updated .env\" >> \$LOG_FILE
        elif [ -f ~/.env ]; then
            mv ~/.env .env
            echo \"Updated .env\" >> \$LOG_FILE
        fi
        [ -f ~/docker-compose.yml ] && mv ~/docker-compose.yml .
"

if [ "$DEPLOY_ADMIN" = true ]; then
    REMOTE_SCRIPT+="
        echo \"=== Deploying ADMIN ===\" >> \$LOG_FILE
        
        # Clean old admin source
        rm -rf bananabot-admin
        
        # Find and extract admin tar
        ADMIN_ARCHIVE=\$(find ~/ -name \"deploy-admin-*.tar.gz\" | head -n 1)
        if [ -f \"\$ADMIN_ARCHIVE\" ]; then
            echo \"Extracting \$ADMIN_ARCHIVE...\" >> \$LOG_FILE
            tar -xzf \"\$ADMIN_ARCHIVE\" >> \$LOG_FILE 2>&1
            rm \"\$ADMIN_ARCHIVE\"
            
            echo \"Rebuilding ADMIN service...\" >> \$LOG_FILE
            sudo docker compose up -d --build --force-recreate admin >> \$LOG_FILE 2>&1
            
            # Prune dangling images
            sudo docker image prune -f >> \$LOG_FILE 2>&1 || true
        else
            echo \"ERROR: Admin archive not found!\" >> \$LOG_FILE
        fi
    "
fi

if [ "$DEPLOY_BOT" = true ]; then
    REMOTE_SCRIPT+="
        echo \"=== Deploying BOT ===\" >> \$LOG_FILE
        
        # Find and extract bot tar
        BOT_ARCHIVE=\$(find ~/ -name \"deploy-bot-*.tar.gz\" | head -n 1)
        if [ -f \"\$BOT_ARCHIVE\" ]; then
            echo \"Extracting \$BOT_ARCHIVE...\" >> \$LOG_FILE
            # Extract over existing files
            tar -xzf \"\$BOT_ARCHIVE\" >> \$LOG_FILE 2>&1
            rm \"\$BOT_ARCHIVE\"
            
            echo \"Rebuilding BOT service...\" >> \$LOG_FILE
            sudo docker compose build bot >> \$LOG_FILE 2>&1
            sudo docker compose up -d bot >> \$LOG_FILE 2>&1
        else
            echo \"ERROR: Bot archive not found!\" >> \$LOG_FILE
        fi
    "
fi

REMOTE_SCRIPT+="
        echo \"[Done] Deployment complete at \$(date)\" >> \$LOG_FILE
    ' > /dev/null 2>&1 &
"

# Execute remote command
gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE" --quiet --command="$REMOTE_SCRIPT"

echo -e "${GREEN}Deployment triggered in background! Logs available at ~/bananabot/deploy-unified.log${NC}"
