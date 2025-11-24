#!/bin/bash
set -e

# Configuration
PROJECT_ID=${PROJECT_ID:-$(gcloud config get-value project)}
INSTANCE_NAME=${INSTANCE_NAME:-"bananabot-vm"}
ZONE=${ZONE:-"europe-north1-c"} # Defaulting to the zone seen in logs

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Checking status of $INSTANCE_NAME in $ZONE...${NC}"

# Get Instance IP
IP_ADDRESS=$(gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE --format='get(networkInterfaces[0].accessConfigs[0].natIP)' 2>/dev/null)

if [ -z "$IP_ADDRESS" ]; then
    echo -e "${RED}Instance not found or no external IP!${NC}"
    exit 1
fi

echo -e "Instance IP: ${GREEN}$IP_ADDRESS${NC}"

# Check Docker Containers
echo -e "\n${GREEN}=== Docker Containers Status ===${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="cd ~/bananabot && sudo docker compose ps"

# Check Health Endpoints (Internal)
echo -e "\n${GREEN}=== Internal Health Checks ===${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="
    echo -n 'Bot (Internal): '
    curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/health | grep -q '200' && echo 'OK' || echo 'FAILED'

    echo -n 'Admin (Internal): '
    curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/api/health | grep -q '200' && echo 'OK' || echo 'FAILED'
"

# Check External Access
echo -e "\n${GREEN}=== External Access Check ===${NC}"
echo "Checking https://$IP_ADDRESS/health (ignoring SSL cert errors)..."
HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" https://$IP_ADDRESS/health)
if [ "$HTTP_CODE" == "200" ]; then
    echo -e "External Health Check: ${GREEN}OK${NC}"
else
    echo -e "External Health Check: ${RED}FAILED (HTTP $HTTP_CODE)${NC}"
fi
