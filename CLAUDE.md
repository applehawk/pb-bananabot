# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Telegram bot for VPN access management built with NestJS. It integrates with Outline VPN servers and handles subscription payments through YooMoney. Users purchase time-based access, manage connections, and interact through a scene-based Telegram bot interface.

## Development Commands

```bash
# Install dependencies
npm install

# Development mode with hot reload
npm run start:dev

# Build the project
npm run build

# Production mode (after build)
npm run start:prod

# Production with database migrations
npm run start:migrate:prod

# Linting
npm run lint

# Testing
npm run test              # Run all tests
npm run test:watch        # Watch mode
npm run test:cov          # With coverage
npm run test:e2e          # End-to-end tests

# Database migrations
npm run prisma:migrate    # Create and apply migrations
```

## Architecture

### Core Stack
- **Framework**: NestJS with TypeScript
- **Database**: SQLite with Prisma ORM (schema: [src/prisma/schema.prisma](src/prisma/schema.prisma))
- **Bot Framework**: Telegraf via `nestjs-telegraf`
- **VPN Integration**: Outline VPN Management API
- **Payment**: YooMoney SDK (custom library in [libs/yoomoney-client](libs/yoomoney-client))

### Module Structure

The application is organized into domain modules:

- **BotModule** ([src/bot.module.ts](src/bot.module.ts)): Main module, bootstraps the Telegram bot and coordinates all other modules
- **PrismaModule**: Database access layer
- **PaymentModule**: Payment processing with strategy pattern for different payment systems
- **UserModule**: User management and balance operations
- **TariffModule**: Subscription plan management

### Key Components

**BotUpdate** ([src/bot.update.ts](src/bot.update.ts)): Main bot controller handling commands and messages
- `/start` - Initializes user and enters START scene
- `/tariff <name> <price>` - Admin command to update tariff pricing
- `/up <username> <amount>` - Admin command to manually adjust user balance
- Hears decorators route button clicks to appropriate scenes

**Scenes System** ([src/scenes/](src/scenes/)): Telegram conversation flows
- All scenes extend `AbstractScene` base class
- Scene navigation defined in [src/constants/scenes.const.ts](src/constants/scenes.const.ts)
- Key scenes: START, HOME, GET_ACCESS, PAYMENT, CONNECT, STATUS, QUESTION
- Each tariff (MONTH, THREEMONTH, SIXMONTH) has its own scene

**OutlineService** ([src/outline/outline.service.ts](src/outline/outline.service.ts)): VPN connection management
- `createConnection()` - Creates new Outline VPN key for user
- `getOutlineDynamicLink()` - Generates `ssconf://` protocol links
- `getConnectionRedirectLink()` - Generates web redirect URLs
- Parses Shadowsocks URLs from Outline API responses

**Payment Flow**:
1. User selects tariff (month/3-month/6-month scenes)
2. PaymentService creates payment record via strategy pattern ([src/payment/strategies/](src/payment/strategies/))
3. Payment validation occurs via webhooks or polling
4. On success, UserService commits balance change
5. Balance changes tracked in BalanceChange table

**User Balance System** ([src/user/user.service.ts](src/user/user.service.ts)):
- `commitBalanceChange()` - Atomic balance updates with transaction logging
- Balance change types: PAYMENT, MANUALLY, SCHEDULER
- Balance changes only applied if status is DONE (not INSUFFICIENT)
- All balance operations create audit trail in BalanceChange table

### Database Schema

Key models in [src/prisma/schema.prisma](src/prisma/schema.prisma):
- **User**: userId (Telegram ID), balance, connLimit, connections[]
- **Connection**: VPN access keys with server details, linked to User
- **Payment**: Payment tracking with YooMoney integration
- **Tariff**: Subscription plans (id, name, price, period in days)
- **BalanceChange**: Audit log for all balance modifications
- **SceneStep**: Scene navigation history

### Configuration

Environment variables required (see `.env`):
- `BOT_TOKEN` - Telegram bot token
- `ADMIN_CHAT_ID` - Admin user's Telegram chat ID
- `OUTLINE_API_URL` - Outline Management API endpoint
- `DOMAIN` - VPN domain for connection links
- `DATABASE_URL` - SQLite database path
- `YOOMONEY_SECRET` - YooMoney webhook secret
- `PORT` - Server port (default: 80)

### Path Aliases

TypeScript path mapping configured in [tsconfig.json](tsconfig.json):
```typescript
"@app/yoomoney-client" → "libs/yoomoney-client/src"
```

### Important Patterns

1. **Scene Navigation**: All user interactions route through scene system. Use `ctx.scene.enter(CommandEnum.SCENE_NAME)` to navigate.

2. **Admin Commands**: Check admin privileges using the private `isAdmin()` method in BotUpdate, which compares `ctx.chat.id` with `ADMIN_CHAT_ID`.

3. **Balance Operations**: Always use `UserService.commitBalanceChange()` rather than direct updates to ensure audit trail.

4. **Connection Limits**: Check `limitExceedWithUser()` before creating new VPN connections.

5. **Payment Strategy**: Use `PaymentStrategyFactory` to create payment processors. Currently only YooMoney implemented.

6. **Error Handling**: Global exception filter configured in BotModule ([src/filters/all-exception.filter.ts](src/filters/all-exception.filter.ts)).

### Security Notes

- TLS verification disabled globally (`NODE_TLS_REJECT_UNAUTHORIZED = '0'` in [src/main.ts](src/main.ts))
- CORS enabled for all origins in production bootstrap
- Admin-only commands protected by chat ID verification
