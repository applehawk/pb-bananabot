# Multi-stage build for optimized production image

# Stage 1: Build
FROM oven/bun:latest AS builder

WORKDIR /app

# 1. Copy package files (for caching dependencies)
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# 2. Install dependencies
# Remove package-lock.json to avoid frozen lockfile errors during migration (since we don't have bun.lockb)
RUN rm -f package-lock.json
# Use --no-save to avoid lockfile issues and --registry to ensure we use npm registry
RUN bun install --no-save || bun install --backend=hardlink --no-save
RUN bun install -D tsc-alias --no-save

# 3. Copy source code, libs, and pre-copied Prisma schema
COPY src ./src
COPY libs ./libs
# Копируем схему Prisma и миграции, которые вы скопировали с подмодуля
COPY bananabot-admin/prisma ./prisma

# 4. Generate Prisma Client
# Удаляем потенциально невалидный symlink, созданный postinstall, перед генерацией
RUN rm -rf node_modules/.prisma
RUN bunx prisma generate --schema=./prisma/schema.prisma

# 5. Build application (NestJS/TypeScript)
RUN bun run build
RUN bunx tsc-alias -p tsconfig.json --outDir ./dist

# ---
# Stage 2: Production
# ---
FROM oven/bun:latest

WORKDIR /app

# Устанавливаем порт по умолчанию для Health Check
ENV PORT=3000
ENV NODE_ENV=production

# 1. Install only production dependencies
COPY package*.json ./
COPY tsconfig.json ./
RUN rm -f package-lock.json
RUN bun install --production --no-save || bun install --production --backend=hardlink --no-save
# Удаляем невалидный symlink после production install
RUN rm -rf node_modules/.prisma

# 2. Copy necessary files from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/libs ./libs
COPY --from=builder /app/src ./src

# Создаем пользователя 'nestjs' с UID 1001 для безопасности
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -m -s /bin/bash nestjs && \
    chown -R nestjs:nodejs /app

USER nestjs

# Set environment variables
ENV NODE_ENV=production

# 4. Health check
# Используем PORT=3000, установленный выше
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD bun -e "require('http').get('http://localhost:${PORT}/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 5. Start application
# Выполняем миграцию Prisma, затем запускаем скомпилированный файл
CMD ["sh", "-c", "bunx prisma migrate deploy --schema=/app/prisma/schema.prisma && bun run dist/src/main-grammy.js"]