.PHONY: clean clean-all clean-build clean-deps clean-cache install build dev start stop kill-port test help \
        submodules-update submodules-status submodules-pull submodules-init \
        admin-dev admin-prod admin-install admin-build admin-stop \
        docker-up docker-down docker-restart docker-logs docker-build docker-ps \
        docker-prune docker-prune-all docker-prune-volumes docker-prune-build \
        db-generate db-migrate db-studio db-push db-reset \
        webhook-set webhook-delete \
        up down logs ps restart

# Default target
help:
	@echo "BananaBot - Available commands:"
	@echo ""
	@echo "Bot commands:"
	@echo "  make clean          - Remove build artifacts and cache files"
	@echo "  make clean-all      - Remove everything (build, deps, cache, logs)"
	@echo "  make install        - Install dependencies"
	@echo "  make build          - Build the project (updates submodules first)"
	@echo "  make dev            - Run in development mode"
	@echo "  make start          - Run in production mode (updates submodules first)"
	@echo "  make ps           # Show running services"
	@echo "  make gc-provision     # Provision Google Cloud VM"
	@echo "  make gc-deploy        # Deploy code to Google Cloud VM (bot + admin)"
	@echo "  make gc-deploy-bot    # Deploy only bot to Google Cloud VM"
	@echo "  make gc-deploy-admin  # Deploy only admin to Google Cloud VM"
	@echo "  make gc-deploy-nginx  # Deploy only nginx configuration"
	@echo "  make gc-status        # Check Google Cloud VM status"
	@echo "  make gc-ssl           # Setup SSL (Let's Encrypt) for Google Cloud VM"
	@echo "  make gc-firewall      # Setup Firewall rules for Google Cloud VM"
	@echo "  make gc-cleanup       # Clean up Docker system on Google Cloud VM"
	@echo "  make gc-resize-disk   # Resize VM disk (stops VM temporarily)"
	@echo "  make gc-backup        # Backup database from Google Cloud VM"
	@echo "  make gc-restore       # Restore database (FILE=path/to/backup.sql.gz)"
	@echo "  make restart        - Stop and start the bot"
	@echo "  make test           - Run tests"
	@echo ""
	@echo "Database commands:"
	@echo "  make db-generate    - Generate Prisma Client"
	@echo "  make db-migrate     - Create and apply migration"
	@echo "  make db-studio      - Open Prisma Studio GUI"
	@echo "  make db-push        - Push schema changes without migration"
	@echo "  make db-reset       - Reset database (⚠️ deletes all data)"
	@echo ""
	@echo "Submodules commands:"
	@echo "  make submodules-init    - Initialize submodules"
	@echo "  make submodules-update  - Update all submodules to latest remote commits"
	@echo "  make submodules-pull    - Pull latest changes in submodules"
	@echo "  make submodules-status  - Show status of all submodules"
	@echo ""
	@echo "Admin Panel commands (local):"
	@echo "  make admin-install  - Install admin panel dependencies"
	@echo "  make admin-dev      - Run admin panel in dev mode (port 3001)"
	@echo "  make admin-build    - Build admin panel for production"
	@echo ""
	@echo "Docker commands (full names):"
	@echo "  make docker-up      - Start all services (bot, admin, postgres, redis)"
	@echo "  make docker-down    - Stop all services"
	@echo "  make docker-restart - Restart all services"
	@echo "  make docker-logs    - Show logs from all services"
	@echo "  make docker-build   - Rebuild all Docker images"
	@echo "  make docker-ps      - Show status of all Docker services"
	@echo "  make admin-prod     - Start only admin panel in Docker"
	@echo "  make admin-stop     - Stop admin panel Docker container"
	@echo ""
	@echo "Docker cleanup commands:"
	@echo "  make docker-prune        - Remove unused containers, networks, images (dangling)"
	@echo "  make docker-prune-all    - Remove ALL unused images (aggressive cleanup)"
	@echo "  make docker-prune-volumes - Remove unused volumes"
	@echo "  make docker-prune-build  - Remove build cache"
	@echo ""
	@echo "Yandex.Cloud commands:"
	@echo "  make yc-build       - Build and push Docker image to Yandex.Cloud"
	@echo "  make yc-deploy      - Deploy revision to Yandex.Cloud Serverless Containers"
	@echo "  make yc-webhook     - Set webhook for Yandex.Cloud Serverless Container"
	@echo "  make yc-logs        - Stream logs from Yandex.Cloud container"
	@echo "  make vm-check       - Check status of Redis/Postgres on VM"
	@echo "  make vm-fix-redis   - Fix Redis on VM (Restart and force master)"
	@echo "  make vm-check-sg    - Check Security Group rules for VM"
	@echo "  make vm-setup-sg    - Setup Security Group for VM (Allow Redis/Postgres)"
	@echo ""
	@echo "Docker commands (short aliases):"
	@echo "  make up             - Alias for docker-up"
	@echo "  make down           - Alias for docker-down"
	@echo "  make logs           - Alias for docker-logs"
	@echo "  make ps             - Alias for docker-ps"
	@echo ""
	@echo "Webhook commands:"
	@echo "  make webhook-set    - Set Telegram webhook"
	@echo "  make webhook-delete - Delete Telegram webhook"
	@echo ""
	@echo "Combined commands:"
	@echo "  make setup          - Full development setup (submodules + deps)"
	@echo "  make deploy         - Full deployment (submodules + build + docker)"
	@echo "  make fresh          - Clean install (clean-all + install + build)"

# Remove build artifacts and cache files
clean:
	@echo "Cleaning build artifacts and cache files..."
	rm -rf dist
	rm -rf coverage
	find . -name ".DS_Store" -type f -delete
	find . -name "._*" -type f -delete
	find . -name "*.log" -type f -delete
	find . -name "*.tsbuildinfo" -type f -delete
	@echo "✓ Clean complete"

# Remove everything including dependencies
clean-all: clean
	@echo "Removing node_modules..."
	rm -rf node_modules
	@echo "✓ Deep clean complete"

# Remove only build output
clean-build:
	@echo "Removing dist folder..."
	rm -rf dist
	@echo "✓ Build artifacts removed"

# Remove only dependencies
clean-deps:
	@echo "Removing node_modules..."
	rm -rf node_modules
	@echo "✓ Dependencies removed"

# Remove only cache and system files
clean-cache:
	@echo "Removing cache files..."
	find . -name ".DS_Store" -type f -delete
	find . -name "*.tsbuildinfo" -type f -delete
	@echo "✓ Cache cleaned"

# Install dependencies
install:
	npm install

# Build the project (with submodules update and prisma generation)
build: submodules-update db-generate
	@echo "Building project..."
	npm run build
	@echo "✓ Build complete"

# Run in development mode (with prisma generation)
dev: db-generate
	npm run start:dev

# Run in production mode (with submodules update and prisma generation)
start: submodules-update db-generate
	@echo "Starting bot in production mode..."
	npm run start:prod

# Stop running bot process
stop:
	@echo "Stopping bot processes..."
	@pkill -f "node dist/src/main-grammy" || echo "No bot process found"
	@echo "✓ Bot stopped"

# Kill process on port 3000
kill-port:
	@echo "Killing process on port 3000..."
	@lsof -ti:3000 | xargs kill -9 2>/dev/null || echo "No process found on port 3000"
	@echo "✓ Port 3000 freed"

# Restart bot (stop + start)
restart: stop kill-port
	@echo "Restarting bot..."
	@sleep 1
	@make start

# Run with migrations in production
start-migrate:
	npm run start:migrate:prod

# Run tests
test:
	npm test

# Run tests with coverage
test-coverage:
	npm run test:cov

# Run linter
lint:
	npm run lint

# Database migrations
migrate:
	npm run prisma:migrate

# Fresh install (clean + install + build)
fresh: clean-all install build
	@echo "✓ Fresh installation complete"

# ============================================================================
# Submodules Management
# ============================================================================

# Update all submodules to latest commits from remote
submodules-update:
	@echo "Updating submodules to latest remote commits..."
	@git submodule update --init --recursive --remote
	@echo "✓ Submodules updated"

# Pull latest changes in submodules
submodules-pull:
	@echo "Pulling latest changes in submodules..."
	@git submodule foreach git pull origin main
	@echo "✓ Submodules pulled"

# Show status of all submodules
submodules-status:
	@echo "Submodules status:"
	@git submodule status

# ============================================================================
# Admin Panel Commands (Local Development)
# ============================================================================

# Install admin panel dependencies
admin-install:
	@echo "Installing admin panel dependencies..."
	cd bananabot-admin && bun install
	@echo "✓ Admin panel dependencies installed"

# Run admin panel in development mode
admin-dev:
	@echo "Starting admin panel in development mode (port 3001)..."
	cd bananabot-admin && bun run dev

# Build admin panel for production
admin-build:
	@echo "Building admin panel for production..."
	cd bananabot-admin && bun run build
	@echo "✓ Admin panel built"

# ============================================================================
# Docker Commands
# ============================================================================

# Start all services with Docker Compose (with prisma generation)
docker-up: db-generate
	@echo "Starting all services (bot, admin, postgres, redis)..."
	@docker compose up -d
	@echo "✓ All services started"
	@echo ""
	@echo "Services available at:"
	@BOT_ADDR=$$(docker compose ps bot --format "{{.Ports}}" | head -n 1 | sed 's/->.*//') && [ -n "$$BOT_ADDR" ] || BOT_ADDR="<not running>"; \
	ADMIN_ADDR=$$(docker compose ps admin --format "{{.Ports}}" | head -n 1 | sed 's/->.*//') && [ -n "$$ADMIN_ADDR" ] || ADMIN_ADDR="<not running>"; \
	PG_ADDR=$$(docker compose ps postgres --format "{{.Ports}}" | head -n 1 | sed 's/->.*//') && [ -n "$$PG_ADDR" ] || PG_ADDR="<not running>"; \
	REDIS_ADDR=$$(docker compose ps redis --format "{{.Ports}}" | head -n 1 | sed 's/->.*//') && [ -n "$$REDIS_ADDR" ] || REDIS_ADDR="<not running>"; \
	echo "  Bot health:    http://$$BOT_ADDR/health"; \
	echo "  Admin panel:   http://$$ADMIN_ADDR"; \
	echo "  PostgreSQL:    $$PG_ADDR"; \
	echo "  Redis:         $$REDIS_ADDR"

# Stop all services
docker-down:
	@echo "Stopping all services..."
	docker compose down
	@echo "✓ All services stopped"

# Restart all services
docker-restart:
	@echo "Restarting all services..."
	docker compose restart
	@echo "✓ All services restarted"

# Show logs from all services
docker-logs:
	docker compose logs -f

# Rebuild all Docker images
docker-build:
	@echo "Rebuilding all Docker images..."
	docker compose build --no-cache
	@echo "✓ Docker images rebuilt"

# Start only admin panel in Docker (production)
admin-prod:
	@echo "Starting admin panel in Docker (production)..."
	docker compose up -d admin
	@echo "✓ Admin panel started at http://localhost:3001"

# Stop admin panel Docker container
admin-stop:
	@echo "Stopping admin panel container..."
	docker compose stop admin
	@echo "✓ Admin panel stopped"

# ============================================================================
# Docker Cleanup Commands
# ============================================================================

# Remove unused Docker data (containers, networks, dangling images)
docker-prune:
	@echo "Removing unused Docker data (containers, networks, dangling images)..."
	docker system prune -f
	@echo "✓ Docker cleanup complete"

# Remove ALL unused images (aggressive cleanup)
docker-prune-all:
	@echo "⚠️  WARNING: This will remove ALL unused Docker images!"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker system prune -a -f; \
		echo "✓ Aggressive Docker cleanup complete"; \
	else \
		echo "Cancelled"; \
	fi

# Remove unused volumes
docker-prune-volumes:
	@echo "⚠️  WARNING: This will remove unused Docker volumes!"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker volume prune -f; \
		echo "✓ Docker volumes cleaned"; \
	else \
		echo "Cancelled"; \
	fi

# Remove build cache
docker-prune-build:
	@echo "Removing Docker build cache..."
	docker builder prune -f
	@echo "✓ Docker build cache cleaned"

# ============================================================================
# Yandex.Cloud Deployment
# ============================================================================

# Build and push Docker image to Yandex.Cloud Container Registry
yc-build:
	@echo "Building and pushing to Yandex.Cloud..."
	@./deploy/yandex.cloud/yc-build.sh
	@echo "✓ Build and push complete"

# Deploy revision to Yandex.Cloud Serverless Containers
yc-deploy:
	@echo "Deploying revision to Yandex.Cloud..."
	@./deploy/yandex.cloud/yc-deploy-revision.sh
	@echo "✓ Deployment complete"

# Set webhook for Yandex.Cloud Serverless Container
yc-webhook:
	@echo "Setting webhook for Yandex.Cloud..."
	@./deploy/yandex.cloud/set-webhook.sh

# Stream logs from Yandex.Cloud Serverless Container
yc-logs:
	@echo "Streaming logs from Yandex.Cloud..."
	@CONTAINER_ID=$$(yc serverless container get --name banana-bot-container --format json | grep -o '"id": "[^"]*"' | head -n 1 | cut -d'"' -f4); \
	if [ -z "$$CONTAINER_ID" ]; then \
		echo "Error: Container 'banana-bot-container' not found."; \
		exit 1; \
	fi; \
	echo "Container ID: $$CONTAINER_ID"; \
	yc logging read --resource-ids=$$CONTAINER_ID --follow

# Check status of Docker containers on Yandex.Cloud VM (Redis/Postgres)
vm-check:
	@echo "Checking VM status..."
	@./deploy/yandex.cloud/check-vm-status.sh

# Fix Redis on VM (Restart and force master mode)
vm-fix-redis:
	@echo "Fixing Redis on VM..."
	@./deploy/yandex.cloud/fix-redis-vm.sh

# Check Security Group rules for VM
vm-check-sg:
	@echo "Checking Security Group rules..."
	@./deploy/yandex.cloud/check-sg-rules.sh

# Setup Security Group for VM (Allow Redis/Postgres)
vm-setup-sg:
	@echo "Setting up Security Group..."
	@./deploy/yandex.cloud/setup-sg.sh

vm-login:
	@echo "Logging into VM..."
	@./deploy/google.cloud/login-vm.sh

vm-logs-bot:
	@echo "Streaming logs from Docker container..."
	@./deploy/google.cloud/docker-compose-logs-bot.sh

# ============================================================================
# Database Commands
# ============================================================================

# Generate Prisma Client
db-generate:
	@echo "Generating Prisma Client..."
	cd bananabot-admin && make prisma-generate
	@echo "✓ Prisma Client generated"

# Create and apply migration
db-migrate:
	@echo "Creating and applying migration..."
	cd bananabot-admin/prisma && npx prisma migrate dev
	@echo "✓ Migration applied"

# Open Prisma Studio
db-studio:
	@echo "Opening Prisma Studio..."
	cd bananabot-admin/prisma && npx prisma studio

# Push schema changes without migration
db-push:
	@echo "Pushing schema changes..."
	cd bananabot-admin/prisma && npx prisma db push
	@echo "✓ Schema pushed"

# Reset database (⚠️ deletes all data)
db-reset:
	@echo "⚠️  WARNING: This will delete all data!"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		cd bananabot-admin/prisma && npx prisma migrate reset --force; \
		echo "✓ Database reset complete"; \
	else \
		echo "Cancelled"; \
	fi

# ============================================================================
# Webhook Commands
# ============================================================================

# Set Telegram webhook
webhook-set:
	@echo "Setting Telegram webhook..."
	npm run webhook:set
	@echo "✓ Webhook set"

# Delete Telegram webhook
webhook-delete:
	@echo "Deleting Telegram webhook..."
	npm run webhook:delete
	@echo "✓ Webhook deleted"

# ============================================================================
# Docker Aliases (Short commands)
# ============================================================================

# Short alias for docker-up
up: docker-up

# Short alias for docker-down
down: docker-down

# Short alias for docker-logs
logs: docker-logs

# Short alias for docker-ps
ps: docker-ps

# Show status of Docker services
docker-ps:
	@echo "Docker services status:"
	docker compose ps

# ============================================================================
# Submodules - Additional Commands
# ============================================================================

# Initialize submodules
submodules-init:
	@echo "Initializing submodules..."
	git submodule update --init --recursive
	@echo "✓ Submodules initialized"

# ============================================================================
# Combined Commands
# ============================================================================

# Full deploy: update submodules, build, and start with Docker
deploy: submodules-update docker-build docker-up
	@echo "✓ Full deployment complete"

# Development setup: install everything
setup: submodules-update install admin-install
	@echo "✓ Development environment setup complete"

# Setup with database initialization
setup-db: setup db-generate db-migrate
	@echo "✓ Full setup with database complete"

# ============================================================================
# Google Cloud Deployment
# ============================================================================

# Provision Google Cloud VM
gc-provision:
	./deploy/google.cloud/setup-firewall.sh
	./deploy/google.cloud/provision.sh

# Deploy code to Google Cloud VM (bot + admin)
gc-deploy:
	./deploy/google.cloud/deploy-all.sh all

# Deploy only bot to Google Cloud VM
gc-deploy-bot:
	./deploy/google.cloud/deploy-all.sh bot

# View deployment logs on Google Cloud VM
gc-deploy-logs:
	./deploy/google.cloud/view-deploy-log.sh

# Deploy only admin to Google Cloud VM
gc-deploy-admin:
	./deploy/google.cloud/deploy-all.sh admin

# Deploy only nginx configuration to Google Cloud VM
gc-deploy-nginx:
	./deploy/google.cloud/deploy-nginx.sh

# Check Google Cloud VM status
gc-status:
	./deploy/google.cloud/check_status.sh

# Setup SSL for Google Cloud VM
gc-ssl:
	./deploy/google.cloud/setup-ssl.sh

# Setup Firewall rules for Google Cloud VM
gc-firewall:
	./deploy/google.cloud/setup-firewall.sh

# Clean up Docker system on Google Cloud VM
gc-cleanup:
	./deploy/google.cloud/cleanup.sh

# Resize VM disk (stops VM temporarily)
gc-resize-disk:
	./deploy/google.cloud/resize-disk.sh

# Backup database from Google Cloud VM
gc-backup:
	./deploy/google.cloud/backup-db.sh

# Restore database to Google Cloud VM
gc-restore:
	@if [ -z "$(FILE)" ]; then \
		./deploy/google.cloud/restore-db.sh; \
	else \
		./deploy/google.cloud/restore-db.sh $(FILE); \
	fi

# Diagnose remote database migrations vs local state
gc-diagnose-migrations:
	npx tsx bananabot-admin/scripts/diagnose-db-state.ts

