#!/bin/bash
set -e

# Configuration
PROJECT_ID=${PROJECT_ID:-$(gcloud config get-value project)}
INSTANCE_NAME=${INSTANCE_NAME:-"bananabot-vm"}
ZONE=${ZONE:-"europe-north1-c"}

# Colors
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}Setting up Swap on $INSTANCE_NAME ($ZONE)...${NC}"

gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="
    # Check if swapfile already exists
    if [ -f /swapfile ]; then
        echo 'Swapfile already exists.'
        free -h
        exit 0
    fi

    echo 'Creating 4G swapfile...'
    # Create a 4G file
    sudo fallocate -l 4G /swapfile
    # Set permissions
    sudo chmod 600 /swapfile
    # Mark as swap
    sudo mkswap /swapfile
    # Enable swap
    sudo swapon /swapfile
    
    # Make permanent (check if already in fstab first to be safe, though -f check above handles it)
    if ! grep -q '/swapfile' /etc/fstab; then
        echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    fi
    
    echo 'Swap setup complete!'
    echo 'Current Memory Usage:'
    free -h
"
