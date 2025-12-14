#!/bin/bash
set -e

# Configuration
PROJECT_ID=${PROJECT_ID:-$(gcloud config get-value project)}
INSTANCE_NAME=${INSTANCE_NAME:-"bananabot-vm"}
ZONE=${ZONE:-"europe-north1-c"}

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Local Build & Deploy Strategy ===${NC}"
echo "This script will build Docker images LOCALLY on your machine and send them to the server."
echo "This prevents the server from crashing due to high RAM usage during builds."
echo ""

# 1. Validation
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running locally!${NC}"
    exit 1
fi


# 0. Backup Database
if [ -f "./deploy/google.cloud/backup-db.sh" ]; then
    echo -e "${GREEN}Step 0: Creating Database Backup...${NC}"
    ./deploy/google.cloud/backup-db.sh
else
    echo -e "${YELLOW}Warning: Backup script not found. Skipping backup.${NC}"
fi

echo -e "${GREEN}Step 1: Building Images for Linux/AMD64...${NC}"
echo "Note: This targets the server architecture (amd64), which might be different from yours."

# Build specifically for linux/amd64
# We use docker buildx explicitly or DOCKER_DEFAULT_PLATFORM
export DOCKER_DEFAULT_PLATFORM=linux/amd64

echo -e "${YELLOW}Building Bot image...${NC}"
docker compose build bot

echo -e "${YELLOW}Building Admin image...${NC}"
docker compose build admin

echo -e "${GREEN}Step 2: Saving Images to archive (compressing)...${NC}"
# Save both images to a single tarball to save connection overhead
docker save bananabot:local bananabot-admin:local | gzip > images.tar.gz

SIZE=$(du -h images.tar.gz | cut -f1)
echo -e "${GREEN}Images saved. Size: $SIZE${NC}"

# 3. Upload and Load
echo -e "${GREEN}Step 3: Uploading and Loading on $INSTANCE_NAME...${NC}"

# We upload the archive
gcloud compute scp images.tar.gz $INSTANCE_NAME:~/images.tar.gz --zone=$ZONE --quiet
rm images.tar.gz

# We trigger the load and restart
echo -e "${GREEN}Step 4: Restarting containers on server...${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="
    echo 'Checking for active background deployments...'
    while ls ~/bananabot/deploy-*.pid >/dev/null 2>&1; do
         echo 'Another deployment is in progress (PID file detected). Waiting 10s...'
         sleep 10
    done

    echo 'Current disk usage:'
    df -h / | tail -n 1

    echo 'Stopping containers to free up space...'
    # We stop containers so we can delete their images
    cd ~/bananabot && docker compose down || true

    echo 'Freeing up space (aggressive prune)...'
    # Remove ALL unused images (including the ones we just stopped using)
    # This is crucial for small disks
    docker system prune -af

    echo 'Disk usage after cleanup:'
    df -h / | tail -n 1

    echo 'Loading images (this may take a minute)...'
    gunzip -c ~/images.tar.gz | docker load
    rm -f ~/images.tar.gz
    
    echo 'Starting containers...'
    cd ~/bananabot && docker compose up -d
    
    echo 'Done!'
"

# Cleanup local


echo -e "${GREEN}Deployment Complete!${NC}"
