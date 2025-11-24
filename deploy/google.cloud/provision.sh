#!/bin/bash
set -e

# Configuration
PROJECT_ID=${PROJECT_ID:-$(gcloud config get-value project)}
INSTANCE_NAME=${INSTANCE_NAME:-"bananabot-vm"}
ZONE=${ZONE:-"europe-north1-c"}
MACHINE_TYPE=${MACHINE_TYPE:-"e2-medium"}
IMAGE_FAMILY=${IMAGE_FAMILY:-"ubuntu-2204-lts"}
IMAGE_PROJECT=${IMAGE_PROJECT:-"ubuntu-os-cloud"}

# Colors
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}Provisioning infrastructure on Google Cloud...${NC}"
echo "Project: $PROJECT_ID"
echo "Instance: $INSTANCE_NAME"
echo "Zone: $ZONE"

# Check if instance exists
if gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE --project=$PROJECT_ID &>/dev/null; then
    echo "Instance $INSTANCE_NAME already exists."
else
    echo -e "${GREEN}Creating instance $INSTANCE_NAME...${NC}"
    gcloud compute instances create $INSTANCE_NAME \
        --project=$PROJECT_ID \
        --zone=$ZONE \
        --machine-type=$MACHINE_TYPE \
        --image-family=$IMAGE_FAMILY \
        --image-project=$IMAGE_PROJECT \
        --tags=http-server,https-server \
        --scopes=cloud-platform \
        --quiet
fi

echo -e "${GREEN}Waiting for instance to be ready...${NC}"
sleep 20

# Get Instance IP
IP_ADDRESS=$(gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE --format='get(networkInterfaces[0].accessConfigs[0].natIP)')
echo -e "${GREEN}Instance IP: $IP_ADDRESS${NC}"

# Run setup on VM
echo -e "${GREEN}Running initial setup on VM...${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="
    # Update and Install Docker
    sudo apt-get update
    sudo apt-get install -y ca-certificates curl gnupg lsb-release
    
    if ! command -v docker &> /dev/null; then
        echo 'Installing Docker...'
        sudo mkdir -p /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
        echo \
          \"deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
          \$(lsb_release -cs) stable\" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
        sudo apt-get update
        sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
        sudo usermod -aG docker \$USER
    fi

    # Setup Project Directory
    mkdir -p ~/bananabot
    cd ~/bananabot

    # Setup SSL (Self-signed for initial startup)
    mkdir -p ssl
    if [ ! -f ssl/fullchain.pem ]; then
        echo 'Generating self-signed SSL certs...'
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout ssl/privkey.pem \
            -out ssl/fullchain.pem \
            -subj '/CN=$IP_ADDRESS'
    fi
"

echo -e "${GREEN}Provisioning complete!${NC}"
echo "You can now run deploy.sh to deploy the application code."
