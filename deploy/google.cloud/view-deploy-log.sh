#!/bin/bash
set -e

# Configuration
PROJECT_ID=${PROJECT_ID:-$(gcloud config get-value project)}
INSTANCE_NAME=${INSTANCE_NAME:-"bananabot-vm"}
ZONE=${ZONE:-"europe-north1-c"}

# Colors
GREEN='\033[0;32m'
NC='\033[0m'

TARGET=${1:-unified}
LOG_FILE="~/bananabot/deploy-${TARGET}.log"

echo -e "${GREEN}Tailing deploy log ($TARGET) on $INSTANCE_NAME...${NC}"
gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE" --command="tail -f $LOG_FILE" -- -t
