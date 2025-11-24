#!/bin/bash
set -e

# Configuration
PROJECT_ID=${PROJECT_ID:-$(gcloud config get-value project)}

# Colors
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}Setting up Firewall rules for Project $PROJECT_ID...${NC}"

# Allow HTTP
if gcloud compute firewall-rules describe default-allow-http --project=$PROJECT_ID &>/dev/null; then
    echo "Firewall rule 'default-allow-http' already exists."
else
    echo "Creating 'default-allow-http' rule..."
    gcloud compute firewall-rules create default-allow-http \
        --project=$PROJECT_ID \
        --allow tcp:80 \
        --source-ranges 0.0.0.0/0 \
        --target-tags http-server \
        --description "Allow HTTP traffic" \
        --quiet
fi

# Allow HTTPS
if gcloud compute firewall-rules describe default-allow-https --project=$PROJECT_ID &>/dev/null; then
    echo "Firewall rule 'default-allow-https' already exists."
else
    echo "Creating 'default-allow-https' rule..."
    gcloud compute firewall-rules create default-allow-https \
        --project=$PROJECT_ID \
        --allow tcp:443 \
        --source-ranges 0.0.0.0/0 \
        --target-tags https-server \
        --description "Allow HTTPS traffic" \
        --quiet
fi

echo -e "${GREEN}Firewall rules configured!${NC}"
