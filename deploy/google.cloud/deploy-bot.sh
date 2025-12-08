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

# 2. Stream source code and execute commands in a single SSH session
echo -e "${GREEN}Streaming source and updating BOT on VM...${NC}"

# Construct the remote command
REMOTE_COMMAND="
    set -e
    mkdir -p ~/bananabot
    cd ~/bananabot

    # Handle configuration files
    if [ -f ~/.env.deploy ]; then
        mv ~/.env.deploy .env
    elif [ -f ~/.env ]; then
        mv ~/.env .env
    fi
    [ -f ~/docker-compose.yml ] && mv ~/docker-compose.yml .

    # Extract source stream
    echo 'Extracting source files...'
    tar -xz

    # Rebuild and restart
    echo 'Rebuilding BOT service (using cache)...'
    sudo docker compose build bot
    
    echo 'Restarting BOT container...'
    sudo docker compose up -d bot

    echo 'BOT deployment complete!'
"

# Tar securely and pipe to SSH
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
    -czf - src/ libs/ prisma/ package*.json tsconfig*.json nest-cli.json .gitmodules Dockerfile bananabot-admin/prisma \
| gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE" --quiet --command="$REMOTE_COMMAND"
