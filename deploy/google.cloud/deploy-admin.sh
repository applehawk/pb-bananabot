#!/bin/bash
set -e

# Configuration
PROJECT_ID=${PROJECT_ID:-$(gcloud config get-value project)}
INSTANCE_NAME=${INSTANCE_NAME:-"bananabot-vm"}
ZONE=${ZONE:-"europe-north1-c"}

# Colors
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}Deploying ADMIN to $INSTANCE_NAME...${NC}"

# Check if bananabot-admin submodule exists
if [ ! -d "bananabot-admin" ]; then
    echo "ERROR: bananabot-admin submodule not found!"
    echo "Run: git submodule update --init --recursive"
    exit 1
fi

# Upload admin files using rsync
echo -e "${GREEN}Syncing admin files to VM...${NC}"
# Ensure target directory exists
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="mkdir -p ~/bananabot/bananabot-admin"

# Sync files
# --delete: remove files on destination that are not in source
# --exclude: skip unnecessary files
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

# Run update on VM
echo -e "${GREEN}Updating ADMIN on VM...${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="
    cd ~/bananabot
    
    echo 'Rebuilding ADMIN service...'
    # Build and restart admin service
    # Docker will use cache for unchanged layers
    sudo docker compose up -d --build admin
    
    # Prune only dangling images (not all unused ones) to save space but keep cache
    echo 'Cleaning up dangling images...'
    sudo docker image prune -f || true

    echo 'ADMIN deployment complete!'
"
