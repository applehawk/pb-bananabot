#!/bin/bash
set -e

# inspect-db.sh: Diagnoses remote database state for schema drift

PROJECT_ID=${PROJECT_ID:-$(gcloud config get-value project)}
INSTANCE_NAME=${INSTANCE_NAME:-"bananabot-vm"}
ZONE=${ZONE:-"europe-north1-c"}
DB_NAME="bananabot"
DB_USER="bananabot"
DB_PASS="bananabot_secret"

echo "=== Inspecting Remote Database Schema ($INSTANCE_NAME) ==="

gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE" --quiet --command="
    cd ~/bananabot && \
    PGPASSWORD='$DB_PASS' sudo docker compose exec -T postgres psql -U $DB_USER -d $DB_NAME <<'EOF'
\echo '--- PRISMA MIGRATIONS STATUS ---'
SELECT migration_name, started_at, finished_at, checksum, logs, rolled_back_at 
FROM _prisma_migrations 
ORDER BY started_at;

\echo ''
\echo '--- TABLE COLUMNS (Schema Check) ---'
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

\echo ''
\echo '--- TABLE CONSTRAINTS ---'
SELECT 
    tc.table_name, 
    kcu.column_name, 
    tc.constraint_name, 
    tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type;
EOF
"
