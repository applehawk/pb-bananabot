#!/bin/bash
set -e

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Colors
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}Deploying ALL services (bot + admin)...${NC}"

# Deploy bot
echo -e "\n${GREEN}=== Deploying BOT ===${NC}"
"$SCRIPT_DIR/deploy-bot.sh"

# Deploy admin
echo -e "\n${GREEN}=== Deploying ADMIN ===${NC}"
"$SCRIPT_DIR/deploy-admin.sh"

echo -e "\n${GREEN}All services deployed!${NC}"
