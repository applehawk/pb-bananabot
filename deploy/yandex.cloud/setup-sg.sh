#!/bin/bash
set -e

# Load configuration
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
source "$SCRIPT_DIR/.yc-config"

# Get subnet ID from VM
SUBNET_ID=$(yc compute instance get --id "$VM_ID" --format json | grep '"subnet_id":' | cut -d'"' -f4)

if [ -z "$SUBNET_ID" ]; then
    echo "Error: Could not determine Subnet ID for VM $VM_ID"
    exit 1
fi

echo "Using Subnet ID: $SUBNET_ID"

# Get network ID from subnet
NETWORK_ID=$(yc vpc subnet get --id "$SUBNET_ID" --format json | grep '"network_id":' | cut -d'"' -f4)

if [ -z "$NETWORK_ID" ]; then
    echo "Error: Could not determine Network ID for VM $VM_ID"
    exit 1
fi

echo "Using Network ID: $NETWORK_ID"

# Check if SG exists
SG_ID=$(yc vpc security-group list --format json | grep -B 5 "\"name\": \"$SECURITY_GROUP_NAME\"" | grep '"id":' | head -n 1 | cut -d'"' -f4)

if [ -z "$SG_ID" ]; then
    echo "Creating Security Group '$SECURITY_GROUP_NAME'..."
    SG_ID=$(yc vpc security-group create --name "$SECURITY_GROUP_NAME" --network-id "$NETWORK_ID" --format json | grep '"id":' | cut -d'"' -f4)
    echo "Created SG: $SG_ID"
    
    echo "Adding rules..."
    # Allow Redis (6379) from internal networks
    yc vpc security-group update-rules "$SG_ID" \
        --add-rule "direction=ingress,protocol=tcp,port=6379,v4-cidrs=[10.0.0.0/8,172.16.0.0/12,192.168.0.0/16]"
    
    # Allow Postgres (5432) from internal networks
    yc vpc security-group update-rules "$SG_ID" \
        --add-rule "direction=ingress,protocol=tcp,port=5432,v4-cidrs=[10.0.0.0/8,172.16.0.0/12,192.168.0.0/16]"
    
    # Allow SSH (22) from everywhere
    yc vpc security-group update-rules "$SG_ID" \
        --add-rule "direction=ingress,protocol=tcp,port=22,v4-cidrs=[0.0.0.0/0]"
    
    # Allow all TCP Egress
    yc vpc security-group update-rules "$SG_ID" \
        --add-rule "direction=egress,protocol=tcp,from-port=1,to-port=65535,v4-cidrs=[0.0.0.0/0]"
    
    # Allow all UDP Egress
    yc vpc security-group update-rules "$SG_ID" \
        --add-rule "direction=egress,protocol=udp,from-port=1,to-port=65535,v4-cidrs=[0.0.0.0/0]"
else
    echo "Security Group '$SECURITY_GROUP_NAME' already exists ($SG_ID). Skipping creation."
fi

echo "Attaching Security Group to VM $VM_ID..."
# We need to get the network interface index/id to update it.
# Usually update-network-interface works with instance update.
yc compute instance update-network-interface "$VM_ID" --network-interface-index 0 --security-group-id "$SG_ID"

echo "Done! Security Group attached."
