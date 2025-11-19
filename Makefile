.PHONY: clean clean-all clean-build clean-deps clean-cache install build dev start stop kill-port test help \
        submodules-update submodules-status submodules-pull submodules-init \
        admin-dev admin-prod admin-install admin-build admin-stop \
        docker-up docker-down docker-restart docker-logs docker-build docker-ps \
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
	@echo "  make stop           - Stop running bot process"
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
	cd bananabot-admin && pnpm install
	@echo "✓ Admin panel dependencies installed"

# Run admin panel in development mode
admin-dev:
	@echo "Starting admin panel in development mode (port 3001)..."
	cd bananabot-admin && pnpm run dev

# Build admin panel for production
admin-build:
	@echo "Building admin panel for production..."
	cd bananabot-admin && pnpm run build
	@echo "✓ Admin panel built"

# ============================================================================
# Docker Commands
# ============================================================================

# Start all services with Docker Compose (with prisma generation)
docker-up: db-generate
	@echo "Starting all services (bot, admin, postgres, redis)..."
	docker-compose up -d
	@echo "✓ All services started"
	@echo ""
	@echo "Services available at:"
	@echo "  Bot health:    http://localhost:3000/health"
	@echo "  Admin panel:   http://localhost:3001"
	@echo "  PostgreSQL:    localhost:5432"
	@echo "  Redis:         localhost:6379"

# Stop all services
docker-down:
	@echo "Stopping all services..."
	docker-compose down
	@echo "✓ All services stopped"

# Restart all services
docker-restart:
	@echo "Restarting all services..."
	docker-compose restart
	@echo "✓ All services restarted"

# Show logs from all services
docker-logs:
	docker-compose logs -f

# Rebuild all Docker images
docker-build:
	@echo "Rebuilding all Docker images..."
	docker-compose build --no-cache
	@echo "✓ Docker images rebuilt"

# Start only admin panel in Docker (production)
admin-prod:
	@echo "Starting admin panel in Docker (production)..."
	docker-compose up -d admin
	@echo "✓ Admin panel started at http://localhost:3001"

# Stop admin panel Docker container
admin-stop:
	@echo "Stopping admin panel container..."
	docker-compose stop admin
	@echo "✓ Admin panel stopped"

# ============================================================================
# Database Commands
# ============================================================================

# Generate Prisma Client
db-generate:
	@echo "Generating Prisma Client..."
	cd prisma && npx prisma generate
	@echo "✓ Prisma Client generated"

# Create and apply migration
db-migrate:
	@echo "Creating and applying migration..."
	cd prisma && npx prisma migrate dev
	@echo "✓ Migration applied"

# Open Prisma Studio
db-studio:
	@echo "Opening Prisma Studio..."
	cd prisma && npx prisma studio

# Push schema changes without migration
db-push:
	@echo "Pushing schema changes..."
	cd prisma && npx prisma db push
	@echo "✓ Schema pushed"

# Reset database (⚠️ deletes all data)
db-reset:
	@echo "⚠️  WARNING: This will delete all data!"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		cd prisma && npx prisma migrate reset --force; \
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
	docker-compose ps

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
