#!/bin/bash
set -e

# Configuration
PROJECT_ID=${PROJECT_ID:-$(gcloud config get-value project)}
INSTANCE_NAME=${INSTANCE_NAME:-"bananabot-vm"}
ZONE=${ZONE:-"europe-north1-c"}

# Colors
GREEN='\033[0;32m'
NC='\033[0m'

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
sed -i "s/server_name yourdomain.com;/server_name $DOMAIN;/g" nginx.conf

# Restart Nginx
echo "Starting Nginx container..."
sudo docker compose up -d nginx

echo "SSL Setup Complete!"
EOF

# Upload script
echo "Uploading setup script..."
gcloud compute scp remote_ssl_setup.sh $INSTANCE_NAME:~/ --zone=$ZONE --quiet

# Run script
echo "Running setup script on VM..."
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="chmod +x ~/remote_ssl_setup.sh && ~/remote_ssl_setup.sh"

# Cleanup
rm remote_ssl_setup.sh
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="rm ~/remote_ssl_setup.sh"

echo -e "${GREEN}SSL configured successfully!${NC}"
echo -e "Your bot is available at: https://$DOMAIN"
echo -e "Webhook URL: https://$DOMAIN/webhook/telegram"
