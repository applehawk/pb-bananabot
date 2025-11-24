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

echo "Checking PostgreSQL configuration on VM $VM_ID at $PUBLIC_IP..."

ssh -i "$VM_SSH_KEY" -o StrictHostKeyChecking=no "$VM_SSH_USER@$PUBLIC_IP" << 'EOF'
    echo "=== PostgreSQL Container Inspect ==="
    docker inspect bananabot-postgres | grep -A 5 "IPAddress"
    
    echo ""
    echo "=== Testing PostgreSQL Connection from VM ==="
    docker exec bananabot-postgres psql -U bananabot -d bananabot -c "SELECT 1;" || echo "Connection failed"
    
    echo ""
    echo "=== Checking PostgreSQL Listen Addresses ==="
    docker logs bananabot-postgres 2>&1 | grep -i "listening" | tail -5
EOF
