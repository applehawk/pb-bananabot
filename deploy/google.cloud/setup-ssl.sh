#!/bin/bash
set -e

# Configuration
PROJECT_ID=${PROJECT_ID:-$(gcloud config get-value project)}
INSTANCE_NAME=${INSTANCE_NAME:-"bananabot-vm"}
ZONE=${ZONE:-"europe-north1-c"}

# Script resolution
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
WEBHOOK_SCRIPT="$REPO_ROOT/scripts/set-webhook.ts"

# Colors
GREEN='\033[0;32m'
NC='\033[0m'

if [ ! -f "$WEBHOOK_SCRIPT" ]; then
    echo "Error: Webhook script not found at $WEBHOOK_SCRIPT"
    exit 1
fi

echo -e "${GREEN}Setting up SSL for $INSTANCE_NAME...${NC}"

# Get Instance IP
IP_ADDRESS=$(gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE --format='get(networkInterfaces[0].accessConfigs[0].natIP)')
DOMAIN="${IP_ADDRESS}.nip.io"
echo -e "Target Domain: ${GREEN}$DOMAIN${NC}"

# Create remote script
cat > remote_ssl_setup.sh <<EOF
#!/bin/bash
set -e

# Install Certbot
if ! command -v certbot &> /dev/null; then
    echo "Installing Certbot..."
    sudo apt-get update
    sudo apt-get install -y certbot
fi

cd ~/bananabot

# Stop Nginx to free port 80 for Certbot
echo "Stopping Nginx container..."
sudo docker compose stop nginx || true

# Request Certificate
echo "Requesting Let's Encrypt certificate..."
sudo certbot certonly --standalone \\
    --non-interactive \\
    --agree-tos \\
    --register-unsafely-without-email \\
    -d $DOMAIN

# Copy certificates to project ssl directory
echo "Copying certificates..."
sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ssl/fullchain.pem
sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ssl/privkey.pem

# Set permissions so Docker can read them
sudo chmod 644 ssl/fullchain.pem ssl/privkey.pem

# Update Nginx Configuration with correct server_name
echo "Updating Nginx configuration..."
sed -i "s/server_name _;/server_name $DOMAIN;/g" nginx.conf
sed -i "s/server_name .*;/server_name $DOMAIN;/g" nginx.conf

# Restart Nginx
echo "Starting Nginx container..."
sudo docker compose up -d nginx

# Setup Webhook
echo "Setting up Webhook..."
CONTAINER_ID=\$(sudo docker compose ps -q bot)
if [ -z "\$CONTAINER_ID" ]; then
    echo "Warning: Bot container is not running. Skipping webhook setup."
else
    # Copy the webhook script to the container
    echo "Copying webhook script to container..."
    sudo docker cp ~/set-webhook.ts \$CONTAINER_ID:/app/set-webhook.ts
    
    # Run the webhook script inside the container
    # We pass DOMAIN explicitly as an env var
    echo "Executing webhook update..."
    sudo docker compose exec -e DOMAIN=$DOMAIN bot bun set-webhook.ts
    
    echo "Webhook setup completed."
fi

echo "SSL Setup Complete!"
EOF

# Upload scripts
echo "Uploading files..."
gcloud compute scp remote_ssl_setup.sh "$WEBHOOK_SCRIPT" $INSTANCE_NAME:~/ --zone=$ZONE --quiet

# Run script
echo "Running setup script on VM..."
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="chmod +x ~/remote_ssl_setup.sh && ~/remote_ssl_setup.sh"

# Cleanup
rm remote_ssl_setup.sh
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="rm ~/remote_ssl_setup.sh ~/set-webhook.ts"

echo -e "${GREEN}SSL configured successfully!${NC}"
echo -e "Your bot is available at: https://$DOMAIN"
echo -e "Webhook URL: https://$DOMAIN/telegram/webhook"
