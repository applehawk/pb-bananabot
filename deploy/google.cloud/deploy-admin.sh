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

# Clean old admin source on server to prevent zombie files
echo -e "${GREEN}Cleaning old admin source on VM...${NC}"
gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE" --quiet --command="rm -rf ~/bananabot/bananabot-admin && mkdir -p ~/bananabot/bananabot-admin"

tar -cz \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='.git' \
    --exclude='dist' \
    --exclude='.turbo' \
    --exclude='.cache' \
    --exclude='*.log' \
    -C bananabot-admin . \
| gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE" --quiet \
    --command="tar -xz -C ~/bananabot/bananabot-admin"

# Diagnose DB State
echo -e "\n${GREEN}=== Diagnosing Database State ===${NC}"
gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE" --command="cd ~/bananabot && docker compose exec -T bananabot-admin npx tsx scripts/diagnose-db-state.ts"

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

# Run update on VM
echo -e "${GREEN}Updating ADMIN on VM...${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="
    cd ~/bananabot
    
    # Move .env if uploaded
    if [ -f ~/bananabot.env ]; then
        echo 'Updating .env file...'
        mv ~/bananabot.env .env
    fi
    
    echo 'Rebuilding ADMIN service...'
    # Build and restart admin service with force-recreate to reload env vars
    # Docker will use cache for unchanged layers
    sudo docker compose up -d --build --force-recreate admin
    
    # Prune only dangling images (not all unused ones) to save space but keep cache
    echo 'Cleaning up dangling images...'
    sudo docker image prune -f || true

    echo 'ADMIN deployment complete!'
"
