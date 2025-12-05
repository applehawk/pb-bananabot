#!/bin/bash
set -e

# Configuration
PROJECT_ID=${PROJECT_ID:-$(gcloud config get-value project)}
INSTANCE_NAME=${INSTANCE_NAME:-"bananabot-vm"}
ZONE=${ZONE:-"europe-north1-c"}
DB_NAME=${DB_NAME:-"bananabot"}
DB_USER=${DB_USER:-"bananabot"}
DB_PASS=${DB_PASS:-"bananabot_secret"}

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${GREEN}${BOLD}Checking status of $INSTANCE_NAME in $ZONE...${NC}"

# Get Instance IP
IP_ADDRESS=$(gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE --format='get(networkInterfaces[0].accessConfigs[0].natIP)' 2>/dev/null)

if [ -z "$IP_ADDRESS" ]; then
    echo -e "${RED}Instance not found or no external IP!${NC}"
    exit 1
fi

echo -e "Instance IP: ${GREEN}$IP_ADDRESS${NC}"

# ============================================================================
# System Resources
# ============================================================================
echo -e "\n${GREEN}${BOLD}=== System Resources ===${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="
    echo -e '${CYAN}Disk Usage:${NC}'
    df -h / | tail -1 | awk '{printf \"  Used: %s / %s (%s)\\n\", \$3, \$2, \$5}'
    
    echo -e '\n${CYAN}Memory:${NC}'
    free -h | awk '/^Mem:/ {printf \"  Used: %s / %s (%.1f%%)\\n\", \$3, \$2, \$3/\$2*100}'
    
    echo -e '\n${CYAN}CPU Load:${NC}'
    uptime | awk -F'load average:' '{print \"  Load average:\" \$2}'
    
    echo -e '\n${CYAN}Uptime:${NC}'
    uptime -p | sed 's/^/  /'
"

# ============================================================================
# Docker Status
# ============================================================================
echo -e "\n${GREEN}${BOLD}=== Docker Containers ===${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="cd ~/bananabot && sudo docker compose ps"

echo -e "\n${GREEN}${BOLD}=== Docker Resource Usage ===${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="
    sudo docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}' 2>/dev/null || echo 'Docker stats unavailable'
"

# ============================================================================
# Health Checks
# ============================================================================
echo -e "\n${GREEN}${BOLD}=== Health Checks ===${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="
    echo -n 'Bot (Internal):   '
    curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/health | grep -q '200' && echo -e '${GREEN}OK${NC}' || echo -e '${RED}FAILED${NC}'

    echo -n 'Admin (Internal): '
    curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/api/health | grep -q '200' && echo -e '${GREEN}OK${NC}' || echo -e '${RED}FAILED${NC}'
"

echo -n "External HTTPS:   "
HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" https://$IP_ADDRESS/health 2>/dev/null || echo "000")
if [ "$HTTP_CODE" == "200" ]; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED (HTTP $HTTP_CODE)${NC}"
fi

# ============================================================================
# Redis Status
# ============================================================================
echo -e "\n${GREEN}${BOLD}=== Redis Status ===${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="
    cd ~/bananabot
    
    echo -n 'Connection: '
    sudo docker compose exec -T redis redis-cli PING 2>/dev/null | grep -q 'PONG' && echo -e '${GREEN}OK${NC}' || echo -e '${RED}FAILED${NC}'
    
    echo 'Info:'
    sudo docker compose exec -T redis redis-cli INFO memory 2>/dev/null | grep -E 'used_memory_human|maxmemory_human' | sed 's/^/  /' || true
    sudo docker compose exec -T redis redis-cli DBSIZE 2>/dev/null | sed 's/^/  Keys: /' || true
"

# ============================================================================
# Database Status
# ============================================================================
echo -e "\n${GREEN}${BOLD}=== Database Status ===${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="
    cd ~/bananabot
    
    echo -e '${CYAN}Connection:${NC}'
    echo -n '  PostgreSQL: '
    PGPASSWORD='$DB_PASS' sudo docker compose exec -T postgres pg_isready -U $DB_USER -d $DB_NAME 2>/dev/null && echo '' || echo -e '${RED}FAILED${NC}'
    
    echo -e '\n${CYAN}Database Size:${NC}'
    PGPASSWORD='$DB_PASS' sudo docker compose exec -T postgres psql -U $DB_USER -d $DB_NAME -t -c \"
        SELECT pg_size_pretty(pg_database_size('$DB_NAME'));
    \" 2>/dev/null | sed 's/^/  Total: /' || echo '  (unavailable)'
    
    echo -e '\n${CYAN}Active Connections:${NC}'
    PGPASSWORD='$DB_PASS' sudo docker compose exec -T postgres psql -U $DB_USER -d $DB_NAME -t -c \"
        SELECT COUNT(*) FROM pg_stat_activity WHERE datname = '$DB_NAME';
    \" 2>/dev/null | sed 's/^/  Count: /' || echo '  (unavailable)'
"

# ============================================================================
# Applied Migrations
# ============================================================================
echo -e "\n${GREEN}${BOLD}=== Applied Migrations ===${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="
    cd ~/bananabot
    PGPASSWORD='$DB_PASS' sudo docker compose exec -T postgres psql -U $DB_USER -d $DB_NAME -c \"
        SELECT migration_name, 
               TO_CHAR(finished_at, 'YYYY-MM-DD HH24:MI:SS') as applied_at
        FROM _prisma_migrations 
        WHERE finished_at IS NOT NULL
        ORDER BY finished_at;
    \" 2>/dev/null || echo 'Cannot connect to database'
"

# ============================================================================
# Tables Overview
# ============================================================================
echo -e "\n${GREEN}${BOLD}=== Tables Overview ===${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="
    cd ~/bananabot
    PGPASSWORD='$DB_PASS' sudo docker compose exec -T postgres psql -U $DB_USER -d $DB_NAME -c \"
        SELECT 
            t.table_name,
            (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'public') as columns,
            pg_stat_get_live_tuples(('public.' || quote_ident(t.table_name))::regclass) as rows,
            pg_size_pretty(pg_total_relation_size(('public.' || quote_ident(t.table_name))::regclass)) as size
        FROM information_schema.tables t
        WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
        ORDER BY pg_total_relation_size(('public.' || quote_ident(t.table_name))::regclass) DESC;
    \" 2>/dev/null
"

# ============================================================================
# Pending Transactions
# ============================================================================
echo -e "\n${GREEN}${BOLD}=== Pending Transactions ===${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="
    cd ~/bananabot
    PGPASSWORD='$DB_PASS' sudo docker compose exec -T postgres psql -U $DB_USER -d $DB_NAME -c \"
        SELECT id, type, status, amount, \\\"creditsAdded\\\", \\\"createdAt\\\"
        FROM \\\"Transaction\\\"
        WHERE status IN ('PENDING', 'PROCESSING')
        ORDER BY \\\"createdAt\\\" DESC
        LIMIT 10;
    \" 2>/dev/null || echo '(unavailable)'
"

# ============================================================================
# Failed Generations (last 24h)
# ============================================================================
echo -e "\n${GREEN}${BOLD}=== Failed Generations (24h) ===${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="
    cd ~/bananabot
    PGPASSWORD='$DB_PASS' sudo docker compose exec -T postgres psql -U $DB_USER -d $DB_NAME -c \"
        SELECT 
            (SELECT COUNT(*) FROM \\\"Generation\\\" WHERE status = 'FAILED' AND \\\"createdAt\\\" > NOW() - INTERVAL '24 hours') as failed_24h,
            (SELECT COUNT(*) FROM \\\"Generation\\\" WHERE \\\"createdAt\\\" > NOW() - INTERVAL '24 hours') as total_24h,
            ROUND(
                (SELECT COUNT(*) FROM \\\"Generation\\\" WHERE status = 'FAILED' AND \\\"createdAt\\\" > NOW() - INTERVAL '24 hours')::numeric * 100 /
                NULLIF((SELECT COUNT(*) FROM \\\"Generation\\\" WHERE \\\"createdAt\\\" > NOW() - INTERVAL '24 hours'), 0),
                2
            ) as failure_rate_pct;
    \" 2>/dev/null
    
    echo -e '\n${CYAN}Recent Failed:${NC}'
    PGPASSWORD='$DB_PASS' sudo docker compose exec -T postgres psql -U $DB_USER -d $DB_NAME -c \"
        SELECT id, type, \\\"errorMessage\\\", \\\"createdAt\\\"
        FROM \\\"Generation\\\"
        WHERE status = 'FAILED'
        ORDER BY \\\"createdAt\\\" DESC
        LIMIT 5;
    \" 2>/dev/null
"

# ============================================================================
# Recent Errors in Logs
# ============================================================================
echo -e "\n${GREEN}${BOLD}=== Recent Errors (Bot Logs) ===${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="
    cd ~/bananabot
    sudo docker compose logs bot --tail=200 2>/dev/null | grep -iE 'error|exception|failed|fatal' | tail -10 || echo '  No recent errors found'
"

echo -e "\n${GREEN}${BOLD}=== Recent Errors (Admin Logs) ===${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="
    cd ~/bananabot
    sudo docker compose logs admin --tail=200 2>/dev/null | grep -iE 'error|exception|failed|fatal' | tail -5 || echo '  No recent errors found'
"

# ============================================================================
# Table Schemas (compact)
# ============================================================================
echo -e "\n${GREEN}${BOLD}=== Table Schemas ===${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="
    cd ~/bananabot
    PGPASSWORD='$DB_PASS' sudo docker compose exec -T postgres psql -U $DB_USER -d $DB_NAME -c \"
        SELECT 
            table_name,
            column_name,
            data_type,
            CASE WHEN is_nullable = 'NO' THEN 'NOT NULL' ELSE '' END as nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position;
    \" 2>/dev/null
"

# ============================================================================
# Last 10 Records Per Table
# ============================================================================
echo -e "\n${GREEN}${BOLD}=== Last 10 Records Per Table ===${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --quiet --command="
    cd ~/bananabot
    
    TABLES=\$(PGPASSWORD='$DB_PASS' sudo docker compose exec -T postgres psql -U $DB_USER -d $DB_NAME -t -c \"
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE' 
        AND table_name != '_prisma_migrations'
        ORDER BY table_name;
    \" 2>/dev/null)
    
    for table in \$TABLES; do
        table=\$(echo \$table | tr -d ' ')
        if [ -n \"\$table\" ]; then
            echo -e \"\n${YELLOW}>>> \$table <<<${NC}\"
            PGPASSWORD='$DB_PASS' sudo docker compose exec -T postgres psql -U $DB_USER -d $DB_NAME -c \"
                SELECT * FROM \\\"\$table\\\"
                ORDER BY 
                    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = '\$table' AND column_name = 'createdAt') THEN 1 ELSE 0 END DESC,
                    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = '\$table' AND column_name = 'id') THEN 1 ELSE 0 END DESC
                LIMIT 10;
            \" 2>/dev/null || echo '  (error reading table)'
        fi
    done
"

echo -e "\n${GREEN}${BOLD}=== Status Check Complete ===${NC}"
