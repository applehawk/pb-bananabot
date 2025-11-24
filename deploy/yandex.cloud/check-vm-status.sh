#!/bin/bash
set -e

# Load configuration
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
source "$SCRIPT_DIR/.yc-config"

# Get Public IP
PUBLIC_IP=$(yc compute instance get --id "$VM_ID" --format json | grep -A 10 "primary_v4_address" | grep '"address": "158' | cut -d'"' -f4)

if [ -z "$PUBLIC_IP" ]; then
    echo "Could not find public IP for VM $VM_ID"
    # Fallback to hardcoded if grep fails (based on previous context)
    PUBLIC_IP="158.160.75.17"
fi

echo "Checking VM $VM_ID at $PUBLIC_IP..."

ssh -i "$VM_SSH_KEY" -o StrictHostKeyChecking=no "$VM_SSH_USER@$PUBLIC_IP" << 'EOF'
    echo "=== Docker Containers Status ==="
    docker ps -a --format "table {{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}"

    echo ""
    echo "=== Redis Logs (Last 20 lines) ==="
    docker logs --tail 20 bananabot-redis 2>&1 || echo "Redis container not found or logs inaccessible"

    echo ""
    echo "=== Postgres Logs (Last 20 lines) ==="
    docker logs --tail 20 bananabot-postgres 2>&1 || echo "Postgres container not found or logs inaccessible"
    
    echo ""
    echo "=== Network Connectivity Check ==="
    echo "Checking if ports are open locally..."
    ss -tuln | grep -E '6379|5432' || echo "Ports 6379 or 5432 not listening"
EOF
