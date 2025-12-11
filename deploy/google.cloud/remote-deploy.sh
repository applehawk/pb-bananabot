#!/bin/bash
# remote-deploy.sh
# Check arguments
DEPLOY_ADMIN=false
DEPLOY_BOT=false
LOCK_MODE="unified"

for arg in "$@"; do
    case $arg in
        admin) DEPLOY_ADMIN=true ;;
        bot) DEPLOY_BOT=true ;;
        all) DEPLOY_ADMIN=true; DEPLOY_BOT=true ;;
        --lock=*) LOCK_MODE="${arg#*=}" ;;
    esac
done

# Save PID for next run
PID_FILE=~/bananabot/deploy-${LOCK_MODE}.pid
echo $$ > "$PID_FILE"
trap "rm -f $PID_FILE" EXIT

set -e
mkdir -p ~/bananabot
cd ~/bananabot

LOG_FILE="deploy-${LOCK_MODE}.log"
echo "[Start] Deployment started at $(date)" > $LOG_FILE

# Telegram Helper
send_telegram() {
    local MODE=$1
    local MSG=$2
    local FILE=$3
    
    if [ -f .env ]; then
            TOKEN=$(grep "^TELEGRAM_BOT_TOKEN=" .env | cut -d'=' -f2- | tr -d '"' | tr -d "'")
            if [ ! -z "$TOKEN" ]; then
            if [ "$MODE" == "doc" ] && [ ! -z "$FILE" ] && [ -f "$FILE" ]; then
                echo "Sending Telegram document: $FILE" >> $LOG_FILE
                curl -s -F chat_id=1155827655 -F document=@"$FILE" -F caption="$MSG" -F parse_mode="HTML" "https://api.telegram.org/bot$TOKEN/sendDocument" >> $LOG_FILE 2>&1
            else
                echo "Sending Telegram message..." >> $LOG_FILE
                curl -s -X POST "https://api.telegram.org/bot$TOKEN/sendMessage" -d chat_id=1155827655 -d text="$MSG" -d parse_mode="HTML" >> $LOG_FILE 2>&1
            fi
            else
            echo "WARNING: TELEGRAM_BOT_TOKEN not found in .env" >> $LOG_FILE
            fi
    fi
}

handle_error() {
    echo "❌ ERROR TRIGGERED! Sending log..." >> $LOG_FILE
    send_telegram "doc" "❌ <b>Deployment Failed on $(hostname)!</b> See log attached." "$LOG_FILE"
}

trap "handle_error" ERR

# 🛑 Prune dangling containers/builders
echo "Checking and removing dangling containers..." >> $LOG_FILE
sudo docker container prune -f >> $LOG_FILE 2>&1
sudo docker builder prune -f >> $LOG_FILE 2>&1
echo "Cleanup complete." >> $LOG_FILE

# Handle configuration files
if [ -f ~/.env.deploy ]; then
    mv ~/.env.deploy .env
    echo "Updated .env" >> $LOG_FILE
elif [ -f ~/.env ]; then
    mv ~/.env .env
    echo "Updated .env" >> $LOG_FILE
fi
if [ -f ~/docker-compose.yml ]; then
    mv -f ~/docker-compose.yml .
    echo "Updated docker-compose.yml" >> $LOG_FILE
else
    echo "WARNING: ~/docker-compose.yml not found, using existing one if present" >> $LOG_FILE
fi

if [ "$DEPLOY_BOT" = true ]; then
    echo "=== Deploying BOT ===" >> $LOG_FILE
    
    # Find and extract bot tar (newest first)
    BOT_ARCHIVE=$(ls -t ~/deploy-bot-*.tar.gz 2>/dev/null | head -n 1)
    if [ -n "$BOT_ARCHIVE" ] && [ -f "$BOT_ARCHIVE" ]; then
        echo "Clean old source files..." >> $LOG_FILE
        rm -rf src libs prisma >> $LOG_FILE 2>&1
        
        echo "Extracting $BOT_ARCHIVE..." >> $LOG_FILE
        # Extract over existing files
        tar -xzf "$BOT_ARCHIVE" >> $LOG_FILE 2>&1
        
        # Verify Dockerfile presence
        if [ -f "Dockerfile" ]; then
             echo "Verified Dockerfile: $(ls -l Dockerfile)" >> $LOG_FILE
        else
             echo "ERROR: Dockerfile missing after extraction!" >> $LOG_FILE
        fi
        
        # Remove ALL bot archives to prevent accumulation
        rm ~/deploy-bot-*.tar.gz >> $LOG_FILE 2>&1 || true
        
        echo "Rebuilding BOT service..." >> $LOG_FILE
        # Ensure previous container is gone to avoid conflicts
        sudo docker stop bananabot-bot || true
        sudo docker rm bananabot-bot || true
        
        sudo docker compose build bot >> $LOG_FILE 2>&1
        sudo docker compose up -d bot >> $LOG_FILE 2>&1
    else
        echo "ERROR: Bot archive not found!" >> $LOG_FILE
    fi
fi

if [ "$DEPLOY_ADMIN" = true ]; then
    echo "=== Deploying ADMIN ===" >> $LOG_FILE
    
    # Clean old admin source
    rm -rf bananabot-admin
    
    # Find and extract admin tar (newest first)
    ADMIN_ARCHIVE=$(ls -t ~/deploy-admin-*.tar.gz 2>/dev/null | head -n 1)
    if [ -n "$ADMIN_ARCHIVE" ] && [ -f "$ADMIN_ARCHIVE" ]; then
        echo "Extracting $ADMIN_ARCHIVE..." >> $LOG_FILE
        tar -xzf "$ADMIN_ARCHIVE" >> $LOG_FILE 2>&1
        
        # Verify Dockerfile presence
        if [ -f "bananabot-admin/Dockerfile" ]; then
             echo "Verified bananabot-admin/Dockerfile: $(ls -l bananabot-admin/Dockerfile)" >> $LOG_FILE
        else
             echo "ERROR: bananabot-admin/Dockerfile missing after extraction!" >> $LOG_FILE
        fi
        
        # Remove ALL admin archives to prevent accumulation
        rm ~/deploy-admin-*.tar.gz >> $LOG_FILE 2>&1 || true
        
        echo "Rebuilding ADMIN service..." >> $LOG_FILE
        sudo docker compose up -d --build --force-recreate admin >> $LOG_FILE 2>&1
        
        # Prune dangling images
        sudo docker image prune -f >> $LOG_FILE 2>&1 || true
    else
        echo "ERROR: Admin archive not found!" >> $LOG_FILE
    fi
fi

# Send Telegram Notification
send_telegram "text" "✅ Deployment to <b>$(hostname)</b> completed successfully!"

echo "[Done] Deployment complete at $(date)" >> $LOG_FILE
