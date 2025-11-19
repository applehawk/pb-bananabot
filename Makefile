.PHONY: clean clean-all clean-build clean-deps clean-cache install build dev start stop kill-port test help \
        submodules-update submodules-status submodules-pull \
        admin-dev admin-prod admin-install admin-build admin-stop \
        docker-up docker-down docker-restart docker-logs docker-build

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
	@echo "Submodules commands:"
	@echo "  make submodules-update  - Update all submodules to latest remote commits"
	@echo "  make submodules-pull    - Pull latest changes in submodules"
	@echo "  make submodules-status  - Show status of all submodules"
	@echo ""
	@echo "Admin Panel commands (local):"
	@echo "  make admin-install  - Install admin panel dependencies"
	@echo "  make admin-dev      - Run admin panel in dev mode (port 3001)"
	@echo "  make admin-build    - Build admin panel for production"
	@echo ""
	@echo "Docker commands:"
	@echo "  make docker-up      - Start all services (bot, admin, postgres, redis)"
	@echo "  make docker-down    - Stop all services"
	@echo "  make docker-restart - Restart all services"
	@echo "  make docker-logs    - Show logs from all services"
	@echo "  make docker-build   - Rebuild all Docker images"
	@echo "  make admin-prod     - Start only admin panel in Docker"
	@echo "  make admin-stop     - Stop admin panel Docker container"

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

# Build the project (with submodules update)
build: submodules-update
	@echo "Building project..."
	npm run build
	@echo "✓ Build complete"

# Run in development mode
dev:
	npm run start:dev

# Run in production mode (with submodules update)
start: submodules-update
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

# Start all services with Docker Compose
docker-up:
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
# Combined Commands
# ============================================================================

# Full deploy: update submodules, build, and start with Docker
deploy: submodules-update docker-build docker-up
	@echo "✓ Full deployment complete"

# Development setup: install everything
setup: submodules-update install admin-install
	@echo "✓ Development environment setup complete"
