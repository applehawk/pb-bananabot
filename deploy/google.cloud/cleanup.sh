#!/bin/bash
set -e

# Configuration
PROJECT_ID=${PROJECT_ID:-$(gcloud config get-value project)}
INSTANCE_NAME=${INSTANCE_NAME:-"bananabot-vm"}
ZONE=${ZONE:-"europe-north1-c"}

# Colors
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}Cleaning up Docker system on $INSTANCE_NAME...${NC}"

# Run cleanup on VM
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="
    echo 'Disk usage before cleanup:'
    df -h /

    echo 'Pruning Docker system (images, containers, networks)...'
    sudo docker system prune -af

    # echo 'Pruning Docker volumes...'
    # sudo docker volume prune -f

    echo 'Disk usage after cleanup:'
    df -h /
"

echo -e "${GREEN}Cleanup complete!${NC}"
