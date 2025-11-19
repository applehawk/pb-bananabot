.PHONY: clean clean-all clean-build clean-deps clean-cache install build dev start stop kill-port test help

# Default target
help:
	@echo "Available commands:"
	@echo "  make clean          - Remove build artifacts and cache files"
	@echo "  make clean-all      - Remove everything (build, deps, cache, logs)"
	@echo "  make clean-build    - Remove dist folder only"
	@echo "  make clean-deps     - Remove node_modules"
	@echo "  make clean-cache    - Remove .DS_Store and cache files"
	@echo "  make install        - Install dependencies"
	@echo "  make build          - Build the project"
	@echo "  make dev            - Run in development mode"
	@echo "  make start          - Run in production mode"
	@echo "  make stop           - Stop running bot process"
	@echo "  make kill-port      - Kill process on port 3000"
	@echo "  make restart        - Stop and start the bot"
	@echo "  make test           - Run tests"

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

# Build the project
build:
	npm run build

# Run in development mode
dev:
	npm run start:dev

# Run in production mode
start:
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
