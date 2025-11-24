#!/bin/bash
set -e

# Configuration
PROJECT_ID=${PROJECT_ID:-$(gcloud config get-value project)}
INSTANCE_NAME=${INSTANCE_NAME:-"bananabot-vm"}
ZONE=${ZONE:-"europe-north1-c"}
NEW_DISK_SIZE=${NEW_DISK_SIZE:-"20GB"}

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Resizing disk for $INSTANCE_NAME...${NC}"
echo -e "${YELLOW}WARNING: This will stop the VM temporarily${NC}"

# Get boot disk name
BOOT_DISK=$(gcloud compute instances describe $INSTANCE_NAME \
    --zone=$ZONE \
    --format='get(disks[0].source)' | awk -F'/' '{print $NF}')

echo "Boot disk: $BOOT_DISK"
echo "New size: $NEW_DISK_SIZE"

# Stop the instance
echo "Stopping instance..."
gcloud compute instances stop $INSTANCE_NAME --zone=$ZONE --quiet

# Resize the disk
echo "Resizing disk..."
gcloud compute disks resize $BOOT_DISK \
    --size=$NEW_DISK_SIZE \
    --zone=$ZONE \
    --quiet

# Start the instance
echo "Starting instance..."
gcloud compute instances start $INSTANCE_NAME --zone=$ZONE --quiet

# Wait for SSH
echo "Waiting for SSH..."
sleep 20

# Resize the filesystem
echo "Resizing filesystem..."
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="
    sudo resize2fs /dev/sda1
    df -h /
"

echo -e "${GREEN}Disk resize complete!${NC}"
