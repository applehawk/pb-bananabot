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

# Prepare admin files
echo -e "${GREEN}Preparing admin panel files...${NC}"
tar --exclude='node_modules' \
    --exclude='.next' \
    --exclude='.git' \
    --exclude='dist' \
    --exclude='.turbo' \
    --exclude='.cache' \
    --exclude='*.log' \
    -czf admin.tar.gz bananabot-admin/

# Upload admin files
echo -e "${GREEN}Uploading admin files to VM...${NC}"
gcloud compute scp admin.tar.gz $INSTANCE_NAME:~/ --zone=$ZONE --quiet

# Clean up local tarball
rm admin.tar.gz

# Run update on VM
echo -e "${GREEN}Updating ADMIN on VM...${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="
    cd ~/bananabot
    
    # Extract admin panel
    echo 'Extracting admin panel...'
    tar -xzf ~/admin.tar.gz
    rm ~/admin.tar.gz

    # Rebuild ADMIN service only
    echo 'Cleaning up old admin images...'
    sudo docker compose stop admin || true
    sudo docker compose rm -f admin || true
    sudo docker image prune -af || true
    
    echo 'Rebuilding ADMIN service...'
    sudo docker compose up -d --build admin

    echo 'ADMIN deployment complete!'
"
