#!/bin/bash
set -e

# Configuration
PROJECT_ID=${PROJECT_ID:-$(gcloud config get-value project)}
INSTANCE_NAME=${INSTANCE_NAME:-"bananabot-vm"}
ZONE=${ZONE:-"europe-north1-c"}

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Deploying BOT to $INSTANCE_NAME...${NC}"

# 1. Prepare configuration files upload
FILES_TO_UPLOAD="docker-compose.yml"
REMOTE_ENV_PATH="~/bananabot/.env"

if [ -f .env.deploy ]; then
    echo -e "${GREEN}Found .env.deploy, using as .env...${NC}"
    FILES_TO_UPLOAD="$FILES_TO_UPLOAD .env.deploy"
elif [ -f .env ]; then
    echo -e "${GREEN}Found .env, using it...${NC}"
    FILES_TO_UPLOAD="$FILES_TO_UPLOAD .env"
else
    echo -e "${YELLOW}WARNING: No .env or .env.deploy file found!${NC}"
fi

echo -e "${GREEN}Uploading configuration files ($FILES_TO_UPLOAD)...${NC}"
# Upload all config files in one go to properties directory
# We upload to home dir first to avoid permission issues, then move
gcloud compute scp $FILES_TO_UPLOAD $INSTANCE_NAME:~/ --zone=$ZONE --quiet

# 2. Archive and uploading source code
echo -e "${GREEN}Archiving source code...${NC}"
TAR_FILE="deploy-bot-$(date +%s).tar.gz"

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
    -czf "$TAR_FILE" - src/ libs/ prisma/ package*.json tsconfig*.json nest-cli.json .gitmodules Dockerfile bananabot-admin/prisma

echo -e "${GREEN}Uploading source archive to $INSTANCE_NAME...${NC}"
gcloud compute scp "$TAR_FILE" "$INSTANCE_NAME:~/bananabot/source.tar.gz" --zone="$ZONE" --quiet

# Clean up local archive
rm "$TAR_FILE"

# 3. Trigger background deployment on VM
echo -e "${GREEN}Triggering background deployment on VM...${NC}"

REMOTE_COMMAND="
    nohup bash -c '
        set -e
        mkdir -p ~/bananabot
        cd ~/bananabot

        echo \"[Start] Deployment started at \$(date)\" > deploy.log

        # Handle configuration files (uploaded to ~/)
        if [ -f ~/.env.deploy ]; then
            mv ~/.env.deploy .env
        elif [ -f ~/.env ]; then
            mv ~/.env .env
        fi
        [ -f ~/docker-compose.yml ] && mv ~/docker-compose.yml .

        # Extract source
        echo \"Extracting source files...\" >> deploy.log
        tar -xzf source.tar.gz >> deploy.log 2>&1
        rm source.tar.gz

        # Rebuild and restart
        echo \"Rebuilding BOT service...\" >> deploy.log
        sudo docker compose build bot >> deploy.log 2>&1
        
        echo \"Restarting BOT container...\" >> deploy.log
        sudo docker compose up -d bot >> deploy.log 2>&1

        echo \"[Done] Deployment complete at \$(date)\" >> deploy.log
    ' > /dev/null 2>&1 &
"

gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE" --quiet --command="$REMOTE_COMMAND"

echo -e "${GREEN}Deployment triggered in background! Logs available at ~/bananabot/deploy.log${NC}"
