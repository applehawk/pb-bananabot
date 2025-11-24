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

FOLDER_ID=$(yc config get folder-id)
if [ -z "$FOLDER_ID" ]; then
    echo "Error: Folder ID not configured in yc. Run 'yc config set folder-id <folder_id>'."
    exit 1
fi

echo "Using Folder ID: $FOLDER_ID"

# Try to get registry
echo "Finding Container Registry in folder $FOLDER_ID..."
# Try to find registry by name if set, otherwise pick first
if [ -n "$REGISTRY_NAME" ]; then
    REGISTRY_ID=$(yc container registry get --name "$REGISTRY_NAME" --folder-id "$FOLDER_ID" --format json 2>/dev/null | grep -o '"id": "[^"]*"' | head -n 1 | cut -d'"' -f4)
fi

if [ -z "$REGISTRY_ID" ]; then
    # Pick the first one
    REGISTRY_ID=$(yc container registry list --folder-id "$FOLDER_ID" --format json | grep -o '"id": "[^"]*"' | head -n 1 | cut -d'"' -f4)
fi

if [ -z "$REGISTRY_ID" ]; then
    echo "No Container Registry found. Creating one..."
    REGISTRY_NAME="bananabot-registry"
    REGISTRY_ID=$(yc container registry create --name "$REGISTRY_NAME" --folder-id "$FOLDER_ID" --format json | grep -o '"id": "[^"]*"' | head -n 1 | cut -d'"' -f4)
    echo "Created registry $REGISTRY_NAME ($REGISTRY_ID)"
fi

echo "Using Registry ID: $REGISTRY_ID"

# Configure docker credential helper if needed
if ! grep -q "cr.yandex" ~/.docker/config.json 2>/dev/null; then
    echo "Configuring docker credential helper..."
    yc container registry configure-docker
fi

IMAGE_TAG="latest"
if [ -n "$1" ]; then
    IMAGE_TAG="$1"
fi

IMAGE_URI="cr.yandex/$REGISTRY_ID/bananabot:$IMAGE_TAG"

echo "Building Docker image..."
# Context is current directory (Project Root)
docker build --platform=linux/amd64 -t "$IMAGE_URI" -f Dockerfile .

echo "Pushing Docker image to $IMAGE_URI..."
docker push "$IMAGE_URI"

echo "Build and push successful!"
# Write .build_env to deploy/yandex.cloud/ so it's found by the other script if run from there?
# Or just write to root?
# The other script will also cd to root.
echo "IMAGE_URI=$IMAGE_URI" > .build_env
echo "Exported IMAGE_URI to .build_env"