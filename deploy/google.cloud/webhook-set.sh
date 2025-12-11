#!/bin/bash
set -e

# Configuration
INSTANCE_NAME=${INSTANCE_NAME:-"bananabot-vm"}
ZONE=${ZONE:-"europe-north1-c"}

# Load .env.deploy
if [ -f .env.deploy ]; then
    echo "Loading configuration from .env.deploy..."
    # Prepare a safe temporary file to source
    # We filter out lines starting with # and ensuring valid assignment format if needed,
    # but direct sourcing is usually fine if the env file is standard.
    # However, to be safe with 'export', we use allexport.
    set -a
    source .env.deploy
    set +a
else
    echo "Error: .env.deploy not found!"
    exit 1
fi

# Get Instance IP
echo "Retrieving IP for $INSTANCE_NAME..."
IP_ADDRESS=$(gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE --format='get(networkInterfaces[0].accessConfigs[0].natIP)')

if [ -z "$IP_ADDRESS" ]; then
    echo "Error: Could not determine IP address."
    exit 1
fi

IP_WITH_DASHES=${IP_ADDRESS//./-} # Not needed for nip.io, but useful for nip.io alternatives. nip.io uses IP directly.
export DOMAIN="${IP_ADDRESS}.nip.io"
export BOT_TOKEN="$TELEGRAM_BOT_TOKEN"

echo "Domain: $DOMAIN"
echo "Bot Token: ${BOT_TOKEN:0:5}..."

# Run the typescript script
echo "Running scripts/set-webhook.ts..."
npx ts-node scripts/set-webhook.ts
