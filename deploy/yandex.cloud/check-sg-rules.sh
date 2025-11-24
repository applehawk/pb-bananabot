#!/bin/bash
set -e

# Load configuration
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
source "$SCRIPT_DIR/.yc-config"

echo "Checking Security Groups for VM $VM_ID..."

# Get Security Group IDs attached to the network interface of the VM
SG_IDS=$(yc compute instance get --id "$VM_ID" --format json | grep -A 20 "network_interfaces" | grep '"security_group_ids":' -A 5 | grep '"' | cut -d'"' -f2)

if [ -z "$SG_IDS" ]; then
    echo "No Security Groups found attached to the VM's network interface."
    echo "The VM might be using the default security group or none (which usually blocks ingress)."
else
    echo "Found Security Groups: $SG_IDS"
    for SG_ID in $SG_IDS; do
        echo "---------------------------------------------------"
        echo "Rules for Security Group $SG_ID:"
        yc vpc security-group get --id "$SG_ID" --format json | grep -A 10 "rules"
        echo "---------------------------------------------------"
    done
fi
