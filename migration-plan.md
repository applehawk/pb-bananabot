# Migration Plan: Project Structure Analysis

## Overview

This document provides a comprehensive analysis of all modules, controllers, and services in the BananaBot Telegram VPN bot project. This analysis serves as a foundation for understanding the architecture before any migration or refactoring efforts.

**Last Updated**: 2025-10-20
**Project**: NestJS Telegram VPN Bot with Outline Integration

---

## Directory Structure

```
src/
├── abstract/                 # Base classes for shared functionality
│   └── abstract.scene.ts    # Base class for all Telegram scenes
├── constants/               # Application-wide constants
│   ├── buttons.const.ts    # Telegram button definitions
│   ├── scenes.const.ts     # Scene configurations
│   └── bot-name.const.ts   # Bot identifier
├── enum/                    # Global enums
│   └── command.enum.ts     # Scene/command navigation enum
├── filters/                 # Global exception filters
│   └── all-exception.filter.ts
├── interceptors/            # HTTP interceptors
│   └── response-time-interceptor.service.ts
├── interfaces/              # TypeScript interfaces
│   └── context.interface.ts # Telegraf Context extension
├── middlewares/             # Telegraf middlewares
│   └── command-args.middleware.ts
├── payment/                 # Payment module (domain)
│   ├── enum/
│   │   ├── payment-status.enum.ts
│   │   ├── payment-system.enum.ts
│   │   ├── balancechange-type.enum.ts
│   │   └── balancechange-status.enum.ts
│   ├── strategies/         # Payment strategy pattern
│   │   ├── factory/
│   │   │   └── payment-strategy.factory.ts
│   │   ├── payment-strategy.interface.ts
│   │   └── yoomoney-payment.strategy.ts
│   ├── payment.controller.ts
│   ├── payment.service.ts
│   ├── payment.module.ts
│   └── payment.scheduler.ts
├── prisma/                  # Database layer
│   ├── migrations/         # Prisma migrations
│   ├── schema.prisma       # Database schema definition
│   ├── prisma.service.ts   # Prisma client service
│   ├── prisma.module.ts
│   └── connection.service.ts
├── scenes/                  # Telegram bot conversation flows
│   ├── start.scene.ts
│   ├── home.scene.ts
│   ├── get-access.scene.ts
│   ├── payment.scene.ts
│   ├── connect.scene.ts
│   ├── status.scene.ts
│   ├── question.scene.ts
│   ├── month-tariff.scene.ts
│   ├── threemonth-tariff.scene.ts
│   ├── sixmonth-tariff.scene.ts
│   └── oneday-tariff.scene.ts
├── tariff/                  # Subscription plan management
│   ├── tariff.service.ts
│   └── tariff.module.ts
├── user/                    # User management
│   ├── user.service.ts
│   └── user.module.ts
├── outline/                 # VPN (Outline) integration
│   ├── outline.service.ts
│   └── outline.controller.ts
├── utils/                   # Utility functions
│   ├── reply-or-edit.ts
│   └── split-array-into-pairs.ts
├── bot.module.ts           # Root module
├── bot.controller.ts       # Main HTTP controller
├── bot.service.ts          # Core bot service
├── bot.update.ts           # Telegraf update handler (main bot logic)
└── main.ts                 # Application entry point
```

---

## Module Analysis

### 1. BotModule (Root Module)

**File**: [src/bot.module.ts](src/bot.module.ts)

**Type**: Root/Bootstrap Module

**Imports**:
- `ConfigModule.forRoot()` - Environment configuration
- `TelegrafModule.forRootAsync()` - Telegram bot integration
- `ScheduleModule.forRoot()` - Cron job scheduler
- `HttpModule` - HTTP client for external APIs
- `PrismaModule` - Database access
- `PaymentModule` - Payment processing
- `UserModule` - User management
- `TariffModule` - Subscription plans

**Providers**:
- Core Services: `BotService`, `BotUpdate`, `ConnectionService`, `UserService`, `OutlineService`
- All Scene Classes: `StartScene`, `HomeScene`, `GetAccessScene`, `PaymentScene`, `ConnectScene`, `StatusScene`, `QuestionScene`, `MonthTariffScene`, `ThreeMonthTariffScene`, `SixMonthTariffScene`
- Global Filter: `APP_FILTER` → `AllExceptionFilter`

**Controllers**: `BotController`, `OutlineController`

**Exports**: `BotService`

**Dependencies Graph**:
```
BotModule
├── ConfigModule (external)
├── TelegrafModule (external)
├── ScheduleModule (external)
├── HttpModule (external)
├── PrismaModule
├── UserModule
├── TariffModule
└── PaymentModule (bidirectional with forwardRef)
```

---

### 2. PrismaModule

**File**: [src/prisma/prisma.module.ts](src/prisma/prisma.module.ts)

**Type**: Infrastructure Module

**Providers**:
- `PrismaService` - Prisma client wrapper with connection lifecycle management

**Exports**: `PrismaService`

**Purpose**: Provides database abstraction layer via PrismaClient ORM

**Dependencies**: None

---

### 3. UserModule

**File**: [src/user/user.module.ts](src/user/user.module.ts)

**Type**: Domain Module

**Imports**: `PrismaModule`

**Providers**: `UserService`

**Exports**: `UserService`

**Purpose**: User lifecycle management, balance operations, connection limits

**Dependencies**:
```
UserModule
└── PrismaModule
```

---

### 4. PaymentModule

**File**: [src/payment/payment.module.ts](src/payment/payment.module.ts)

**Type**: Domain Module

**Imports**:
- `PrismaModule`
- `UserModule`
- `TariffModule`
- `YooMoneyClientModule` (from `@app/yoomoney-client`)
- `BotModule` (forwardRef - circular dependency)

**Providers**:
- `PaymentService` - Main payment orchestration
- `PaymentStrategyFactory` - Factory for payment strategies
- `PaymentScheduler` - Cron jobs for payment validation and balance deductions

**Controllers**: `PaymentController`

**Exports**: `PaymentService`

**Purpose**: Payment processing with strategy pattern for multiple payment systems

**Dependencies**:
```
PaymentModule
├── PrismaModule
├── UserModule
├── TariffModule
├── YooMoneyClientModule (external library)
└── BotModule (forwardRef - bidirectional)
```

---

### 5. TariffModule

**File**: [src/tariff/tariff.module.ts](src/tariff/tariff.module.ts)

**Type**: Domain Module

**Imports**: `PrismaModule`

**Providers**: `TariffService`

**Exports**: `TariffService`

**Purpose**: Subscription plan management (CRUD operations on tariffs)

**Dependencies**:
```
TariffModule
└── PrismaModule
```

---

## Controllers Analysis

### 1. BotController

**File**: [src/bot.controller.ts](src/bot.controller.ts)

**Base Route**: `/`

**Endpoints**:

| Method | Route | Handler | Purpose |
|--------|-------|---------|---------|
| GET | `/` | `ping()` | Health check endpoint, returns "pong" |

**Dependencies**: None

---

### 2. OutlineController

**File**: [src/outline/outline.controller.ts](src/outline/outline.controller.ts)

**Base Route**: `/`

**Endpoints**:

| Method | Route | Handler | Purpose |
|--------|-------|---------|---------|
| GET | `/redirect/:version/:connIdHex/:connName` | `getConnection()` | Redirects to Outline VPN `ssconf://` link |
| GET | `/conf/:version/:connIdHex/:connName` | `handleConfig()` | Returns connection configuration as JSON |

**URL Parameters**:
- `version` - Connection version identifier
- `connIdHex` - Hex-encoded connection hash ID
- `connName` - Connection name

**Dependencies**:
- `ConnectionService`
- `OutlineService`

**Security**: Uses HMAC-SHA256 hashed connection IDs to prevent enumeration

---

### 3. PaymentController

**File**: [src/payment/payment.controller.ts](src/payment/payment.controller.ts)

**Base Route**: `/payment`

**Endpoints**:

| Method | Route | Handler | Purpose |
|--------|-------|---------|---------|
| GET | `/payment/yoomoney/success` | `success()` | Redirect page after successful YooMoney payment |
| POST | `/payment/yoomoney/notification` | `yooMoneyWebHook()` | Webhook endpoint for YooMoney payment notifications |
| GET | `/payment/:paymentId` | `getPayment()` | Returns HTML payment form for specified payment |

**Dependencies**:
- `PaymentService`

**Security**:
- Webhook validates SHA1 hash signature
- Payment forms are time-limited (expire after 10 minutes)

---

## Services Analysis

### 1. BotService

**File**: [src/bot.service.ts](src/bot.service.ts)

**Type**: Core Service

**Key Methods**:

| Method | Parameters | Returns | Purpose |
|--------|-----------|---------|---------|
| `upsertUser()` | `ctx: Context` | `Promise<User>` | Create or update user on first bot interaction |
| `start()` | `ctx: Context` | `Promise<void>` | Display home screen |
| `sendMessage()` | `chatId: number, message: string` | `Promise<void>` | Send Telegram message |
| `sendInsufficientChargeMessage()` | `chatId: number, amount: number` | `Promise<void>` | Notify user of insufficient balance |
| `sendPaymentSuccessMessage()` | `chatId: number, amount: number` | `Promise<void>` | Notify user of successful payment |
| `sendPaymentSuccessMessageToAdmin()` | `userId: number, amount: number` | `Promise<void>` | Notify admins of new payment |

**Properties**:
- `minimumBalance` - Daily service fee amount from config

**Dependencies**:
- `Telegraf<Context>` (injected bot instance)
- `ConfigService`
- `UserService`

**Purpose**: Bot lifecycle, messaging, user onboarding, notification delivery

---

### 2. UserService

**File**: [src/user/user.service.ts](src/user/user.service.ts)

**Type**: Domain Service

**Key Methods**:

| Method | Parameters | Returns | Purpose |
|--------|-----------|---------|---------|
| `findOneByUserId()` | `userId: number` | `Promise<User \| null>` | Get user by Telegram ID |
| `findUserByUsername()` | `username: string` | `Promise<User>` | Get user by Telegram username |
| `limitExceedWithUser()` | `user: User` | `Promise<boolean>` | Check if user exceeded connection limit |
| `commitBalanceChange()` | `user: User, change: number, type: BalanceChangeTypeEnum, paymentId?: string` | `Promise<BalanceChange>` | **Atomic balance update with audit trail** |
| `usersWithBalance()` | `amount: number` | `Promise<User[]>` | Find users with balance >= amount |
| `createUser()` | `data: Prisma.UserCreateInput` | `Promise<User>` | Create new user |
| `upsert()` | `user: Prisma.UserCreateInput` | `Promise<User>` | Create or update user |
| `updateUser()` | `params: UpdateUserParams` | `Promise<User>` | Update user data |
| `user()` | `userWhereUniqueInput` | `Promise<User \| null>` | Get user by unique input |

**Critical Business Logic**:
- `commitBalanceChange()` is the **only** way to modify user balance
- Creates audit trail in `BalanceChange` table for every balance operation
- Balance change only applied if `status === DONE`
- If `(balance + change) <= 0`, status becomes `INSUFFICIENT` (no update)

**Dependencies**:
- `PrismaService`

**Purpose**: User CRUD, balance tracking with audit trail, connection limit management

---

### 3. PaymentService

**File**: [src/payment/payment.service.ts](src/payment/payment.service.ts)

**Type**: Domain Service

**Key Methods**:

| Method | Parameters | Returns | Purpose |
|--------|-----------|---------|---------|
| `createPayment()` | `userId, chatId, tariffId, paymentSystem` | `Promise<PaymentProxy>` | Create payment record using strategy pattern |
| `validatePayment()` | `paymentId: string` | `Promise<Payment>` | Validate payment status and commit balance if paid |
| `getPaymentForm()` | `paymentId: string` | `Promise<string>` | Get HTML payment form |
| `yooMoneyWebHook()` | `notification: any` | `Promise<void>` | Process YooMoney webhook notification |
| `getPendingPayments()` | - | `Promise<Payment[]>` | Get all payments with PENDING status |
| `updatePaymentStatus()` | `paymentId, status, isFinal` | `Promise<Payment>` | Update payment status |

**Payment Flow**:
1. `createPayment()` → Uses `PaymentStrategyFactory` to instantiate payment strategy
2. Strategy creates payment record and generates payment URL/form
3. User completes payment via external provider
4. Webhook or polling triggers `validatePayment()`
5. If status is PAID, calls `UserService.commitBalanceChange()`
6. Sends success notifications to user and admins

**Dependencies**:
- `ConfigService`
- `UserService`
- `TariffService`
- `PrismaService`
- `PaymentStrategyFactory`
- `YooMoneyClient`

**Purpose**: Payment lifecycle management, webhook processing, balance commitment

---

### 4. PaymentScheduler

**File**: [src/payment/payment.scheduler.ts](src/payment/payment.scheduler.ts)

**Type**: Background Service (Cron Jobs)

**Scheduled Jobs**:

| Schedule | Method | Purpose |
|----------|--------|---------|
| `EVERY_DAY_AT_MIDNIGHT` | `handleDailyCharge()` | Deduct daily service fee from all users with sufficient balance |
| `EVERY_10_SECONDS` | `handlePendingPayments()` | Poll pending payments and validate status |

**Logic**:
```typescript
// Daily charge flow
1. Get all users with balance >= minimumBalance
2. For each user:
   - Commit balance change of -minimumBalance with SCHEDULER type
   - If status === INSUFFICIENT, send warning message
   - If status === DONE, balance updated successfully

// Pending payment polling
1. Get all PENDING payments
2. For each payment:
   - Call PaymentService.validatePayment()
   - If PAID, triggers balance update and notifications
```

**Dependencies**:
- `PaymentService`
- `UserService`
- `BotService`

**Purpose**: Automated payment validation and daily balance deductions

---

### 5. OutlineService

**File**: [src/outline/outline.service.ts](src/outline/outline.service.ts)

**Type**: Integration Service

**Key Methods**:

| Method | Parameters | Returns | Purpose |
|--------|-----------|---------|---------|
| `createConnection()` | `userId: number, connName: string` | `Promise<Connection>` | Create new VPN key with limit check |
| `getOutlineDynamicLink()` | `connection: Connection` | `string` | Generate `ssconf://` protocol link |
| `getConnectionRedirectLink()` | `connection: Connection` | `string` | Generate HTTPS redirect URL |
| `parseOutlineAccessUrl()` | `accessUrl: string` | `OutlineSSConnection` | Parse Shadowsocks URL |

**Private Methods**:
- `createNewKey()` - Call Outline API to create new key
- `renameKey()` - Rename key on Outline server

**Connection Flow**:
1. Check user connection limit with `UserService.limitExceedWithUser()`
2. Call Outline API to create new key
3. Parse Shadowsocks URL from response
4. Save connection to database via `ConnectionService`
5. Generate dynamic links for user

**Dependencies**:
- `ConfigService`
- `UserService`
- `ConnectionService`
- `HttpService`

**Purpose**: Outline VPN server integration, connection creation, URL generation

---

### 6. TariffService

**File**: [src/tariff/tariff.service.ts](src/tariff/tariff.service.ts)

**Type**: Domain Service

**Key Methods**:

| Method | Parameters | Returns | Purpose |
|--------|-----------|---------|---------|
| `getOneById()` | `id: string` | `Promise<Tariff>` | Get tariff by ID |
| `getOneByName()` | `name: string` | `Promise<Tariff>` | Get tariff by name |
| `getAllTariffs()` | - | `Promise<Tariff[]>` | Get all tariffs sorted by price |
| `updateTariffPrice()` | `name: string, price: number` | `Promise<Tariff>` | Admin command to update tariff price |

**Dependencies**:
- `PrismaService`

**Purpose**: Subscription plan CRUD operations

---

### 7. ConnectionService

**File**: [src/prisma/connection.service.ts](src/prisma/connection.service.ts)

**Type**: Repository Service

**Key Methods**:

| Method | Parameters | Returns | Purpose |
|--------|-----------|---------|---------|
| `connection()` | `connWhereUniqueInput` | `Promise<Connection \| null>` | Get connection by unique input |
| `connections()` | `params` | `Promise<Connection[]>` | Get multiple connections |
| `connectionFirst()` | `params` | `Promise<Connection \| null>` | Get first matching connection |
| `createConnectionEntry()` | `data` | `Promise<Connection>` | Create connection record |
| `createConnectionEntryWithOutlineConn()` | `outlineConn, userId` | `Promise<Connection>` | Create connection with parsed Outline data |
| `connectionByHashId()` | `hashId: string` | `Promise<Connection \| null>` | Lookup by hash ID |
| `updateConnnectionEntry()` | `params` | `Promise<Connection>` | Update connection |
| `deleteConnectionEntry()` | `where` | `Promise<Connection>` | Delete connection |
| `count()` | - | `Promise<number>` | Count total connections |

**Security**:
- Generates HMAC-SHA256 hash IDs for secure connection lookup
- Hash prevents connection enumeration attacks

**Dependencies**:
- `PrismaService`

**Purpose**: Connection CRUD operations, hash ID generation

---

### 8. PrismaService

**File**: [src/prisma/prisma.service.ts](src/prisma/prisma.service.ts)

**Type**: Infrastructure Service

**Purpose**:
- Extends `PrismaClient`
- Handles database connection lifecycle
- Provides ORM access to all modules

**Dependencies**: None (external Prisma library)

---

## Database Schema (Prisma)

**File**: [src/prisma/schema.prisma](src/prisma/schema.prisma)

### Models

#### User
```prisma
model User {
  userId      Int      @id          // Telegram user ID (primary key)
  chatId      Int?                  // Telegram chat ID
  firstname   String?
  lastname    String?
  username    String?
  connLimit   Int                   // Max VPN connections allowed
  balance     Int                   // Balance in rubles
  connections Connection[]          // One-to-many
  createdAt   DateTime @default(now())
}
```

#### Connection
```prisma
model Connection {
  id          Int      @id @default(autoincrement())
  hashId      String                // HMAC-SHA256 hash for secure lookup
  name        String                // Connection name
  server      String                // Outline server IP
  server_port String                // Shadowsocks port
  password    String                // Shadowsocks password
  method      String                // Encryption method
  access_url  String                // Full Shadowsocks URL
  user        User?    @relation(fields: [userId], references: [userId])
  userId      Int?
  createdAt   DateTime @default(now())
}
```

#### Payment
```prisma
model Payment {
  paymentId       String   @id       // UUID
  orderId         String
  status          String   @default("PENDING")  // PENDING|PAID|FAILED|CANCELED
  paymentSystem   String   @default("YOOMONEY")
  userId          Int
  chatId          Int
  tariffId        String
  amount          Int
  paymentAt       DateTime
  paymentAmount   Int
  paymentCurrency String
  url             String              // Payment form URL
  form            String              // HTML payment form
  isFinal         Boolean?
  // Future payment systems fields
  transactionId   String?
  payerAmount     String?
  payerCurrency   String?
  network         String?
  address         String?
  from            String?
  txid            String?
  email           String?
}
```

#### Tariff
```prisma
model Tariff {
  id      String @id @unique  // "MONTH_TARIFF", "THREEMONTH_TARIFF", etc.
  name    String
  price   Int                 // Price in rubles
  period  Int                 // Duration in days
  caption String
  @@index([price])
}
```

#### BalanceChange (Audit Trail)
```prisma
model BalanceChange {
  id           Int      @id @default(autoincrement())
  userId       Int
  paymentId    String?                           // Link to payment
  balance      Int                               // Balance before change
  changeAmount Int                               // Change amount (can be negative)
  type         String   @default("PAYMENT")      // PAYMENT|MANUALLY|SCHEDULER
  status       String                            // DONE|INSUFFICIENT
  changeAt     DateTime @default(now())
}
```

#### SceneStep
```prisma
model SceneStep {
  id        Int      @id @default(autoincrement())
  scene     String
  nextScene String
  date      DateTime @default(now())
}
```

---

## Enums

### CommandEnum
**File**: [src/enum/command.enum.ts](src/enum/command.enum.ts)

**Purpose**: Scene navigation identifiers

**Values**:
- Navigation: `START`, `HOME`, `BACK`, `QUESTION`, `JOIN_CHAT`
- Features: `STATUS`, `CONNECT`, `GET_ACCESS`, `PAYMENT`
- Tariffs: `MONTH_TARIFF`, `THREEMONTH_TARIFF`, `SIXMONTH_TARIFF`, `ONEDAY_TARIFF`
- Payment: `PAY_WITH_YOOMONEY`, `CONFIRM_PAYMENT`
- Outline: `OUTLINE_APPLE`, `OUTLINE_ANDROID`, `OUTLINE_DOWNLOADED`

---

### Payment Enums

#### PaymentStatusEnum
**File**: [src/payment/enum/payment-status.enum.ts](src/payment/enum/payment-status.enum.ts)

```typescript
enum PaymentStatusEnum {
  PENDING = "PENDING",
  PAID = "PAID",
  FAILED = "FAILED",
  CANCELED = "CANCELED"
}
```

#### PaymentSystemEnum
**File**: [src/payment/enum/payment-system.enum.ts](src/payment/enum/payment-system.enum.ts)

```typescript
enum PaymentSystemEnum {
  YOOMONEY = "YOOMONEY",
  YOOKASSA = "YOOKASSA",     // Not implemented
  CYPTOMUS = "CYPTOMUS",     // Not implemented
  WALLET = "WALLET",         // Not implemented
  CASH = "CASH"              // Not implemented
}
```

#### BalanceChangeTypeEnum
**File**: [src/payment/enum/balancechange-type.enum.ts](src/payment/enum/balancechange-type.enum.ts)

```typescript
enum BalanceChangeTypeEnum {
  PAYMENT = "PAYMENT",       // From user payment
  MANUALLY = "MANUALLY",     // Admin adjustment
  SCHEDULER = "SCHEDULER"    // Daily automatic deduction
}
```

#### BalanceChangeStatusEnum
**File**: [src/payment/enum/balancechange-status.enum.ts](src/payment/enum/balancechange-status.enum.ts)

```typescript
enum BalanceChangeStatusEnum {
  DONE = "DONE",                 // Balance updated successfully
  INSUFFICIENT = "INSUFFICIENT"   // Balance too low, no update
}
```

---

## Key Design Patterns

### 1. Strategy Pattern (Payment Systems)

**Location**: [src/payment/strategies/](src/payment/strategies/)

**Components**:
- `PaymentStrategy` interface - Defines contract for all payment strategies
- `PaymentStrategyFactory` - Creates concrete strategy instances based on `PaymentSystemEnum`
- `YooMoneyPaymentStrategy` - Implementation for YooMoney payment system

**Extensibility**: New payment systems (YooKassa, CryptoMus) can be added by:
1. Creating new strategy class implementing `PaymentStrategy`
2. Adding to `PaymentSystemEnum`
3. Updating factory to instantiate new strategy

---

### 2. Scene-Based Architecture (Telegram Bot)

**Location**: [src/scenes/](src/scenes/)

**Base Class**: `AbstractScene` ([src/abstract/abstract.scene.ts](src/abstract/abstract.scene.ts))

**Pattern**:
- All scenes extend `AbstractScene`
- Decorated with `@Scene(CommandEnum.SCENE_NAME)`
- Use `@SceneEnter()` and `@SceneLeave()` lifecycle hooks
- Navigation via `ctx.scene.enter(CommandEnum.NEXT_SCENE)`

**Benefits**:
- Modular conversation flows
- Easy to add new features as scenes
- Centralized scene configuration in `SCENES` constant

---

### 3. Repository Pattern (Data Access)

**Services**:
- `UserService` - User repository
- `ConnectionService` - Connection repository
- `TariffService` - Tariff repository

**Pattern**: Domain services wrap `PrismaService` to provide business logic on top of database operations

---

## Module Dependency Graph

```
BotModule (Root)
├── ConfigModule ✓
├── TelegrafModule ✓
├── ScheduleModule ✓
├── HttpModule ✓
├── PrismaModule
│   └── (no dependencies)
├── UserModule
│   └── PrismaModule
├── TariffModule
│   └── PrismaModule
└── PaymentModule
    ├── PrismaModule
    ├── UserModule
    ├── TariffModule
    ├── YooMoneyClientModule ✓
    └── BotModule (forwardRef) ⚠️
```

**Legend**:
- ✓ = External library/framework
- ⚠️ = Circular dependency (resolved with forwardRef)

---

## Circular Dependencies

### PaymentModule ↔ BotModule

**Reason**:
- `PaymentModule` needs `BotService` to send payment notifications
- `BotModule` needs `PaymentModule` for payment scenes

**Resolution**: Using `forwardRef()` in module imports

**Recommendation**: Consider extracting notification logic to a separate `NotificationModule` to break this cycle

---

## Configuration Management

**Service**: `ConfigService` (from `@nestjs/config`)

**Environment Variables** (from `.env`):

| Variable | Purpose | Example |
|----------|---------|---------|
| `BOT_TOKEN` | Telegram bot token | `1234567890:ABCdef...` |
| `ADMIN_CHAT_ID` | Primary admin Telegram ID | `123456789` |
| `ADMIN_CHAT_ID_2` | Secondary admin Telegram ID | `987654321` |
| `OUTLINE_API_URL` | Outline Management API endpoint | `https://vpn.example.com:8080/xyz123/` |
| `DOMAIN` | Domain for payment/connection links | `example.com` |
| `DATABASE_URL` | SQLite database path | `file:./dev.db` |
| `YOOMONEY_SECRET` | YooMoney webhook secret | `abc123...` |
| `YOOMONEY_SUCCESS_URL` | Payment success redirect | `https://example.com/payment/success` |
| `MINIMUM_BALANCE` | Daily service fee | `3` |
| `NODE_ENV` | Environment | `development` or `production` |
| `PORT` | Server port | `80` |

---

## Security Considerations

### Current Security Measures:
1. **Admin Commands**: Protected by `ctx.chat.id === ADMIN_CHAT_ID` check
2. **Connection Hash IDs**: HMAC-SHA256 prevents enumeration
3. **Webhook Validation**: YooMoney webhooks validated with SHA1 signature
4. **Payment Link Expiry**: Payment buttons auto-expire after 10 minutes

### Security Issues:
1. **TLS Verification Disabled**: `NODE_TLS_REJECT_UNAUTHORIZED = '0'` in [src/main.ts](src/main.ts:6) - Should be fixed
2. **CORS Wide Open**: Allows all origins in production - Should be restricted
3. **No Rate Limiting**: Bot commands not rate-limited
4. **Balance Stored as Integer**: Should consider using decimal for precise financial calculations

---

## Migration Recommendations

### 1. Break Circular Dependencies
- Extract `NotificationService` from `BotService`
- Move notification logic to standalone module
- Update `PaymentModule` to depend on `NotificationModule` instead of `BotModule`

### 2. Improve Security
- Fix TLS verification (remove `NODE_TLS_REJECT_UNAUTHORIZED`)
- Restrict CORS to specific domains
- Add rate limiting middleware
- Consider moving to decimal balance storage

### 3. Enhance Payment System
- Implement additional payment strategies (YooKassa, CryptoMus)
- Add payment retry logic
- Implement refund functionality

### 4. Database Optimizations
- Add indexes on frequently queried fields (`User.username`, `Connection.userId`)
- Consider migration from SQLite to PostgreSQL for production
- Add database connection pooling

### 5. Testing
- Add unit tests for services (currently no test files)
- Add E2E tests for payment flow
- Add integration tests for Outline API

### 6. Code Quality
- Extract magic numbers to constants (e.g., payment link expiry time)
- Add JSDoc comments to public methods
- Implement DTO validation with class-validator
- Add request/response logging

---

## File Reference Matrix

| Component Type | Count | Location Pattern |
|---------------|-------|------------------|
| Modules | 5 | `src/**/*.module.ts` |
| Controllers | 3 | `src/**/*.controller.ts` |
| Services | 8 | `src/**/*.service.ts` |
| Scenes | 11 | `src/scenes/*.scene.ts` |
| Enums | 5 | `src/**/enum/*.enum.ts` |
| Interfaces | 2 | `src/interfaces/*.interface.ts` |
| Strategies | 2 | `src/payment/strategies/*.ts` |

---

## Summary

This codebase follows a **modular domain-driven architecture** with clear separation of concerns:

- **Infrastructure Layer**: PrismaModule, ConfigModule
- **Domain Layer**: UserModule, PaymentModule, TariffModule
- **Application Layer**: BotModule, Scenes
- **Integration Layer**: OutlineService, Payment Strategies

The architecture is **extensible** (strategy pattern for payments, scene-based bot flows) and **maintainable** (clear module boundaries, repository pattern), but has room for improvement in security, testing, and dependency management.
