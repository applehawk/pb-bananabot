# Multi-stage build for optimized production image

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Install dependencies
RUN apk add --no-cache git
RUN npm ci

# Copy source code
COPY src ./src

# Copy libs (local modules like yoomoney-client)
COPY libs ./libs

# Update .gitmodules
COPY .gitmodules .gitmodules
RUN git submodule update --init --recursive prisma || true

# Copy prisma submodule
COPY prisma ./prisma

# Generate Prisma Client to root node_modules
# This ensures @prisma/client is available for the application
RUN npx prisma generate --schema=./prisma/schema.prisma

# Build application
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# Create /data directory for persistent storage (Amvera requirement)
RUN mkdir -p /data && chmod 755 /data

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 && \
    chown -R nestjs:nodejs /app /data

USER nestjs

# Expose port (must match amvera.yml containerPort)
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application with migrations
CMD ["sh", "-c", "npx prisma migrate deploy --schema=./prisma/schema.prisma && node dist/src/main-grammy.js"]
