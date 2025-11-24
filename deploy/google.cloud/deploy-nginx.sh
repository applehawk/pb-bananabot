#!/bin/bash
set -e

# Configuration
PROJECT_ID=${PROJECT_ID:-$(gcloud config get-value project)}
INSTANCE_NAME=${INSTANCE_NAME:-"bananabot-vm"}
ZONE=${ZONE:-"europe-north1-c"}

# Colors
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}Deploying NGINX configuration to $INSTANCE_NAME...${NC}"

# Check if nginx.conf exists
if [ ! -f "deploy/google.cloud/nginx.conf" ]; then
    echo "ERROR: deploy/google.cloud/nginx.conf not found!"
    exit 1
fi

# Upload nginx config
echo -e "${GREEN}Uploading nginx configuration...${NC}"
gcloud compute scp deploy/google.cloud/nginx.conf $INSTANCE_NAME:~/nginx.conf --zone=$ZONE --quiet

# Update nginx on VM
echo -e "${GREEN}Updating NGINX on VM...${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="
    cd ~/bananabot
    
    # Backup old config
    if [ -f nginx.conf ]; then
        cp nginx.conf nginx.conf.backup.\$(date +%Y%m%d_%H%M%S)
    fi
    
    # Move new config
    mv ~/nginx.conf nginx.conf
    
    # Restart nginx
    echo 'Restarting Nginx...'
    sudo docker compose restart nginx

    echo 'NGINX configuration updated!'
"

echo -e "${GREEN}Nginx deployment complete!${NC}"
