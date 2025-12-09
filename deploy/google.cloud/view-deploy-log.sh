#!/bin/bash
set -e

# Configuration
PROJECT_ID=${PROJECT_ID:-$(gcloud config get-value project)}
INSTANCE_NAME=${INSTANCE_NAME:-"bananabot-vm"}
ZONE=${ZONE:-"europe-north1-c"}

# Colors
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}Tailing deploy log on $INSTANCE_NAME...${NC}"
gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE" --command="tail -f ~/bananabot/deploy-unified.log" -- -t
