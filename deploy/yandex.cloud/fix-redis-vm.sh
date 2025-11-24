#!/bin/bash
set -e

# Load configuration
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
source "$SCRIPT_DIR/.yc-config"

# Get Public IP
PUBLIC_IP=$(yc compute instance get --id "$VM_ID" --format json | grep -A 10 "primary_v4_address" | grep '"address": "158' | cut -d'"' -f4)

if [ -z "$PUBLIC_IP" ]; then
    echo "Could not find public IP for VM $VM_ID"
    PUBLIC_IP="158.160.75.17"
fi

echo "Fixing Redis on VM $VM_ID at $PUBLIC_IP..."

ssh -i "$VM_SSH_KEY" -o StrictHostKeyChecking=no "$VM_SSH_USER@$PUBLIC_IP" << 'EOF'
    echo "Stopping Redis container..."
    docker stop bananabot-redis || true
    docker rm bananabot-redis || true

    echo "Cleaning Redis volume..."
    # Find the volume name. Assuming it follows docker-compose naming convention or is named 'redis_data'
    # We'll just inspect the volume if it exists, or try to find it.
    # Actually, let's just run a new container with a FLUSHALL command if we want to keep the volume, 
    # OR if we suspect the config is bad, we should wipe the volume.
    
    # Let's try to find the volume used by the previous container (too late if removed).
    # Assuming standard docker-compose volume name: bananabot_redis_data or similar.
    
    # Prune unused volumes to be safe? No, dangerous.
    
    # Let's just start a fresh Redis container manually to verify it works, 
    # mirroring the docker-compose settings.
    
    echo "Starting fresh Redis container..."
    docker run -d \
      --name bananabot-redis \
      --restart unless-stopped \
      -p 6379:6379 \
      -v bananabot_redis_data:/data \
      --network bananabot-network \
      redis:7-alpine \
      redis-server --appendonly yes --replicaof no one

    # Note: Added --replicaof no one to force master mode.
    
    echo "Waiting for Redis to start..."
    sleep 5
    
    echo "Checking Redis logs..."
    docker logs --tail 20 bananabot-redis
    
    echo "Checking Redis status..."
    docker exec bananabot-redis redis-cli ping
EOF
