#!/bin/bash
set -e

# Determine script directory and project root
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
PROJECT_ROOT="$SCRIPT_DIR/../.."

# Change to project root
cd "$PROJECT_ROOT"

# Function to check and install/init yc
check_yc() {
    if ! command -v yc &> /dev/null; then
        echo "Error: 'yc' CLI is not installed. Please install it first."
        exit 1
    fi

    if ! yc config profile list &> /dev/null; then
        echo "'yc' is not initialized. Starting initialization..."
        yc init
    fi
}

check_yc

# Load .env.deploy if exists
if [ -f ".env.deploy" ]; then
    source ".env.deploy"
fi

# Load build env if exists (for IMAGE_URI)
if [ -f ".build_env" ]; then
    source ".build_env"
fi

FOLDER_ID=$(yc config get folder-id)
if [ -z "$FOLDER_ID" ]; then
    echo "Error: Folder ID not configured in yc. Run 'yc config set folder-id <folder_id>'."
    exit 1
fi

echo "Using Folder ID: $FOLDER_ID"

# Service Account
if [ -z "$SERVICE_ACCOUNT_ID" ]; then
    # Try to find one
    SERVICE_ACCOUNT_ID=$(yc iam service-account list --folder-id "$FOLDER_ID" --format json | grep -o '"id": "[^"]*"' | head -n 1 | cut -d'"' -f4)
    
    if [ -z "$SERVICE_ACCOUNT_ID" ]; then
        echo "Error: No Service Account found. Please create one or set SERVICE_ACCOUNT_ID."
        exit 1
    fi
fi
echo "Using Service Account ID: $SERVICE_ACCOUNT_ID"

# Network
if [ -z "$NETWORK_ID" ]; then
    NETWORK_ID=$(yc vpc network list --folder-id "$FOLDER_ID" --format json | grep -o '"id": "[^"]*"' | head -n 1 | cut -d'"' -f4)
    
    if [ -z "$NETWORK_ID" ]; then
        echo "Error: No VPC Network found. Please create one or set NETWORK_ID."
        exit 1
    fi
fi
echo "Using Network ID: $NETWORK_ID"

if [ -z "$IMAGE_URI" ]; then
    echo "IMAGE_URI not set. Attempting to construct it..."
    
    # Try to find registry
    if [ -n "$REGISTRY_NAME" ]; then
        REGISTRY_ID=$(yc container registry get --name "$REGISTRY_NAME" --folder-id "$FOLDER_ID" --format json 2>/dev/null | grep -o '"id": "[^"]*"' | head -n 1 | cut -d'"' -f4)
    fi

    if [ -z "$REGISTRY_ID" ]; then
        # Pick the first one
        REGISTRY_ID=$(yc container registry list --folder-id "$FOLDER_ID" --format json | grep -o '"id": "[^"]*"' | head -n 1 | cut -d'"' -f4)
    fi

    if [ -z "$REGISTRY_ID" ]; then
        echo "Error: No Container Registry found and IMAGE_URI not provided."
        echo "Please run 'make yc-build' first or create a registry."
        exit 1
    fi
    
    IMAGE_TAG="latest"
    IMAGE_URI="cr.yandex/$REGISTRY_ID/bananabot:$IMAGE_TAG"
    echo "Constructed IMAGE_URI: $IMAGE_URI"
fi

if [ -z "$CONTAINER_NAME" ]; then
    CONTAINER_NAME="banana-bot-container"
fi

echo "Deploying revision for container: $CONTAINER_NAME"
echo "Image: $IMAGE_URI"

# Secrets handling
# We try to preserve the secrets configuration. 
# If SECRET_ID is not set, we try to find a secret named 'bananabot-secrets'
if [ -z "$SECRET_ID" ]; then
    SECRET_ID=$(yc lockbox secret list --folder-id "$FOLDER_ID" --format json | grep -B 5 '"name": "bananabot-secrets"' | grep -o '"id": "[^"]*"' | head -n 1 | cut -d'"' -f4)
    
    # Fallback to the hardcoded one from previous script if not found (risky but compatible)
    if [ -z "$SECRET_ID" ]; then
        # Try to find ANY secret? No, that's dangerous.
        # Let's warn.
        echo "Warning: SECRET_ID not found. Using hardcoded ID from previous script if available, or failing."
        # Check if we have the hardcoded one in the command below.
        # I will use a variable for the secret ID in the command.
        SECRET_ID="e6qsbf4cnee54kmh9igb" # Default from previous script
    fi
fi

# Version ID is also tricky. It changes.
# We should get the latest version of the secret.
if [ -n "$SECRET_ID" ]; then
    SECRET_VERSION_ID=$(yc lockbox secret get --id "$SECRET_ID" --format json | grep -o '"current_version": { "id": "[^"]*"' | cut -d'"' -f6)
    if [ -z "$SECRET_VERSION_ID" ]; then
         echo "Warning: Could not fetch secret version. Using default/hardcoded."
         SECRET_VERSION_ID="e6qll9j0g00lsbbhtj8p"
    fi
fi

echo "Using Secret ID: $SECRET_ID"

# Try to fetch the latest secret version
LATEST_SECRET_VERSION=$(yc lockbox secret list-versions --id "$SECRET_ID" --format json 2>/dev/null | grep '"id":' | head -n 1 | cut -d'"' -f4)

if [ -n "$LATEST_SECRET_VERSION" ]; then
    SECRET_VERSION_ID="$LATEST_SECRET_VERSION"
    echo "Using Latest Secret Version: $SECRET_VERSION_ID"
else
    echo "Warning: Could not fetch latest secret version. Using configured version."
    echo "Using Secret Version: $SECRET_VERSION_ID"
fi

yc serverless container revision deploy \
  --container-name "${CONTAINER_NAME}" \
  --image "${IMAGE_URI}" \
  --service-account-id "${SERVICE_ACCOUNT_ID}" \
  --folder-id "${FOLDER_ID}" \
  --memory 1024MB \
  --cores 1 \
  --min-instances 1 \
  --concurrency 8 \
  --environment "NODE_ENV=${NODE_ENV:-production},GEMINI_MODEL=${GEMINI_MODEL:-gemini-2.5-flash-image},REDIS_URL=${REDIS_URL}" \
  --network-id "${NETWORK_ID}" \
  --secret "id=${SECRET_ID},version-id=${SECRET_VERSION_ID},key=TELEGRAM_BOT_TOKEN,environment-variable=TELEGRAM_BOT_TOKEN" \
  --secret "id=${SECRET_ID},version-id=${SECRET_VERSION_ID},key=GEMINI_API_KEY,environment-variable=GEMINI_API_KEY" \
  --secret "id=${SECRET_ID},version-id=${SECRET_VERSION_ID},key=YOOMONEY_TOKEN,environment-variable=YOOMONEY_TOKEN" \
  --secret "id=${SECRET_ID},version-id=${SECRET_VERSION_ID},key=YOOMONEY_SECRET,environment-variable=YOOMONEY_SECRET" \
  --secret "id=${SECRET_ID},version-id=${SECRET_VERSION_ID},key=DATABASE_URL,environment-variable=DATABASE_URL" \
  --secret "id=${SECRET_ID},version-id=${SECRET_VERSION_ID},key=TELEGRAM_SECRET_TOKEN,environment-variable=TELEGRAM_SECRET_TOKEN"