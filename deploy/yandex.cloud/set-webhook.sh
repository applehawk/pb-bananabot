#!/bin/bash
set -e

# Load configuration
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
source "$SCRIPT_DIR/.yc-config"

echo "Setting up webhook for Serverless Container..."

# Get container ID
CONTAINER_ID=$(yc serverless container get --name "$CONTAINER_NAME" --format json | grep '"id":' | head -n 1 | cut -d'"' -f4)

if [ -z "$CONTAINER_ID" ]; then
    echo "Error: Container '$CONTAINER_NAME' not found."
    exit 1
fi

echo "Container ID: $CONTAINER_ID"

# Get container URL (domain)
CONTAINER_URL=$(yc serverless container get --name "$CONTAINER_NAME" --format json | grep '"url":' | cut -d'"' -f4)

if [ -z "$CONTAINER_URL" ]; then
    echo "Error: Could not get container URL."
    exit 1
fi

# Remove https:// prefix and trailing slash if present
DOMAIN=$(echo "$CONTAINER_URL" | sed 's|https://||' | sed 's|/$||')

echo "Container Domain: $DOMAIN"

# Get secrets from Yandex Lockbox
echo "Fetching secrets from Lockbox..."

# Get BOT_TOKEN
BOT_TOKEN=$(yc lockbox payload get --id "$SECRET_ID" --version-id "$SECRET_VERSION_ID" --format json | grep -A 1 '"key": "TELEGRAM_BOT_TOKEN"' | grep '"text_value":' | cut -d'"' -f4)

if [ -z "$BOT_TOKEN" ]; then
    echo "Error: Could not fetch TELEGRAM_BOT_TOKEN from Lockbox."
    exit 1
fi

# Get SECRET_TOKEN
SECRET_TOKEN=$(yc lockbox payload get --id "$SECRET_ID" --version-id "$SECRET_VERSION_ID" --format json | grep -A 1 '"key": "TELEGRAM_SECRET_TOKEN"' | grep '"text_value":' | cut -d'"' -f4)

if [ -z "$SECRET_TOKEN" ]; then
    echo "Warning: TELEGRAM_SECRET_TOKEN not found in Lockbox. Proceeding without it."
fi

echo ""
echo "🔑 Retrieved credentials:"
echo "  BOT_TOKEN: ${BOT_TOKEN:0:10}...${BOT_TOKEN: -10}"
if [ -n "$SECRET_TOKEN" ]; then
    echo "  SECRET_TOKEN: ${SECRET_TOKEN:0:10}...${SECRET_TOKEN: -10}"
else
    echo "  SECRET_TOKEN: (not set)"
fi
echo ""

# Set webhook using curl
WEBHOOK_URL="https://${DOMAIN}/telegram/webhook"

echo "Setting webhook to: $WEBHOOK_URL"

if [ -n "$SECRET_TOKEN" ]; then
    RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
        -H "Content-Type: application/json" \
        -d "{\"url\":\"${WEBHOOK_URL}\",\"secret_token\":\"${SECRET_TOKEN}\",\"drop_pending_updates\":true}")
else
    RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
        -H "Content-Type: application/json" \
        -d "{\"url\":\"${WEBHOOK_URL}\",\"drop_pending_updates\":true}")
fi

echo "Response: $RESPONSE"

# Check if successful
if echo "$RESPONSE" | grep -q '"ok":true'; then
    echo "✅ Webhook set successfully!"
    
    # Get webhook info
    echo ""
    echo "📋 Webhook Info:"
    WEBHOOK_INFO=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo")
    echo "$WEBHOOK_INFO" | grep -o '"url":"[^"]*"' | cut -d'"' -f4 | sed 's/^/  URL: /'
    echo "$WEBHOOK_INFO" | grep -o '"pending_update_count":[0-9]*' | sed 's/.*:/  Pending Updates: /'
else
    echo "❌ Failed to set webhook"
    exit 1
fi
