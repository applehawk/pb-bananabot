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

echo -e "${GREEN}Deploying ADMIN to $INSTANCE_NAME...${NC}"

# Check if bananabot-admin submodule exists
if [ ! -d "bananabot-admin" ]; then
    echo "ERROR: bananabot-admin submodule not found!"
    echo "Run: git submodule update --init --recursive"
    exit 1
fi

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
gcloud compute scp $FILES_TO_UPLOAD $INSTANCE_NAME:~/ --zone=$ZONE --quiet

# 2. Stream source and execute commands in a single SSH session
echo -e "${GREEN}Streaming source and updating ADMIN on VM...${NC}"

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

    # Clean old admin source to prevent zombie files and extract new one
    echo 'Cleaning and extracting admin source...'
    rm -rf bananabot-admin
    tar -xz

    echo 'Rebuilding ADMIN service...'
    # Build and restart admin service with force-recreate to reload env vars
    sudo docker compose up -d --build --force-recreate admin
    
    # Prune only dangling images
    echo 'Cleaning up dangling images...'
    sudo docker image prune -f || true

    echo 'ADMIN deployment complete!'
"

tar -czf - \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='.git' \
    --exclude='dist' \
    --exclude='.turbo' \
    --exclude='.cache' \
    --exclude='*.log' \
    bananabot-admin \
| gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE" --quiet --command="$REMOTE_COMMAND"
