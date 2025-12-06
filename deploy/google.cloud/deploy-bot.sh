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

# Prepare project files (только исходники, без зависимостей)
echo -e "${GREEN}Preparing source files...${NC}"
tar --exclude='node_modules' \
    --exclude='.git' \
    --exclude='dist' \
    --exclude='.env' \
    --exclude='logs' \
    --exclude='postgres_data' \
    --exclude='redis_data' \
    --exclude='bananabot-admin' \
    --exclude='*.log' \
    --exclude='.turbo' \
    --exclude='.cache' \
    -czf bot-src.tar.gz src/ libs/ prisma/ package*.json tsconfig*.json nest-cli.json .gitmodules Dockerfile

# Upload files
echo -e "${GREEN}Uploading source files to VM...${NC}"
gcloud compute scp bot-src.tar.gz $INSTANCE_NAME:~/ --zone=$ZONE --quiet

# Upload .env file
if [ -f .env.deploy ]; then
    echo -e "${GREEN}Found .env.deploy, uploading as .env...${NC}"
    gcloud compute scp .env.deploy $INSTANCE_NAME:~/bananabot.env --zone=$ZONE --quiet
elif [ -f .env ]; then
    echo -e "${GREEN}Found .env, using it...${NC}"
    gcloud compute scp .env $INSTANCE_NAME:~/bananabot.env --zone=$ZONE --quiet
else
    echo -e "${YELLOW}WARNING: No .env or .env.deploy file found!${NC}"
fi

# Upload docker-compose.yml
echo -e "${GREEN}Uploading docker-compose.yml...${NC}"
gcloud compute scp docker-compose.yml $INSTANCE_NAME:~/bananabot/docker-compose.yml --zone=$ZONE --quiet

# Clean up local tarball
rm bot-src.tar.gz

# Run update on VM
echo -e "${GREEN}Updating BOT on VM...${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="
    cd ~/bananabot
    
    # Extract only source files
    echo 'Extracting source files...'
    tar -xzf ~/bot-src.tar.gz
    rm ~/bot-src.tar.gz
    
    # Move .env if uploaded
    if [ -f ~/bananabot.env ]; then
        mv ~/bananabot.env .env
    fi

    # Rebuild BOT service with cache
    echo 'Rebuilding BOT service (using cache)...'
    sudo docker compose build bot
    
    echo 'Restarting BOT container...'
    sudo docker compose up -d bot

    echo 'BOT deployment complete!'
"
