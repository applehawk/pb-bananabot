#!/bin/bash
set -e

# Configuration
PROJECT_ID=${PROJECT_ID:-$(gcloud config get-value project)}
INSTANCE_NAME=${INSTANCE_NAME:-"bananabot-vm"}
ZONE=${ZONE:-"europe-north1-c"}

# Colors
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}Deploying code to $INSTANCE_NAME...${NC}"

# Prepare project files
echo -e "${GREEN}Preparing project files...${NC}"
tar --exclude='node_modules' \
    --exclude='.git' \
    --exclude='dist' \
    --exclude='.env' \
    --exclude='logs' \
    --exclude='postgres_data' \
    --exclude='redis_data' \
    -czf project.tar.gz .

# Upload files
echo -e "${GREEN}Uploading files to VM...${NC}"
gcloud compute scp project.tar.gz $INSTANCE_NAME:~/ --zone=$ZONE --quiet

# Upload .env file
if [ -f .env.deploy ]; then
    echo -e "${GREEN}Found .env.deploy, uploading as .env...${NC}"
    gcloud compute scp .env.deploy $INSTANCE_NAME:~/bananabot.env --zone=$ZONE --quiet
elif [ -f .env ]; then
    echo -e "${GREEN}Found .env, using it...${NC}"
    gcloud compute scp .env $INSTANCE_NAME:~/bananabot.env --zone=$ZONE --quiet
else
    echo "WARNING: No .env or .env.deploy file found! You will need to configure it on the server."
fi

# Clean up local tarball
rm project.tar.gz

# Run update on VM
echo -e "${GREEN}Updating application on VM...${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="
    # Setup Project Directory
    mkdir -p ~/bananabot
    tar -xzf ~/project.tar.gz -C ~/bananabot
    
    # Move .env if uploaded
    if [ -f ~/bananabot.env ]; then
        mv ~/bananabot.env ~/bananabot/.env
    fi

    cd ~/bananabot

    # Use Google Cloud Nginx Config
    if [ -f deploy/google.cloud/nginx.conf ]; then
        cp deploy/google.cloud/nginx.conf nginx.conf
    fi

    # Restart Services
    echo 'Rebuilding and restarting Docker services...'
    sudo docker compose down --remove-orphans || true
    sudo docker compose up -d --build

    echo 'Deployment complete!'
"
