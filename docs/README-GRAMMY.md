# BananaBot - grammY Version

Telegram VPN Bot built with NestJS and grammY.

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- Outline VPN Server

### Installation

1. **Install dependencies using the grammY package.json:**

```bash
npm install --package-lock-only --package-lock=package-grammy.json
npm ci
```

Or manually copy `package-grammy.json` to `package.json` and run:

```bash
npm install
```

2. **Configure environment variables:**

Copy `.env.example` to `.env` and fill in:

```env
# Telegram Bot
BOT_TOKEN=your_bot_token_here
ADMIN_CHAT_ID=your_telegram_user_id
ADMIN_CHAT_ID_2=optional_second_admin_id

# Outline VPN
OUTLINE_API_URL=https://your-outline-server.com:8080/your-api-key/

# Server
DOMAIN=your-domain.com
PORT=80
NODE_ENV=development

# Database
DATABASE_URL=file:./src/prisma/dev.db

# Payment (YooMoney)
YOOMONEY_SECRET=your_yoomoney_secret
YOOMONEY_SUCCESS_URL=https://your-domain.com/payment/yoomoney/success

# App Settings
MINIMUM_BALANCE=3

# Webhook (optional, for production)
TELEGRAM_SECRET_TOKEN=your_random_secret_token
```

3. **Generate Prisma client:**

```bash
npm run prisma:generate
```

4. **Run database migrations:**

```bash
npm run prisma:migrate
```

### Development (Polling Mode)

```bash
npm run start:dev
```

The bot will start in polling mode, suitable for local development.

### Production (Webhook Mode)

1. **Build the application:**

```bash
npm run build:grammy
```

2. **Set webhook URL:**

```bash
npm run webhook:set
```

This will configure Telegram to send updates to `https://your-domain.com/telegram/webhook`.

3. **Start production server:**

```bash
npm run start:prod
```

Or with database migrations:

```bash
npm run start:migrate:prod
```

---

## 📁 Project Structure

```
src/
├── grammy/                         # grammY implementation
│   ├── grammy.module.ts           # Core grammY module
│   ├── grammy.service.ts          # Bot lifecycle management
│   ├── grammy-context.interface.ts # Extended context
│   ├── bot.module.ts              # Main application module
│   ├── bot.service.ts             # High-level bot operations
│   ├── bot.update.ts              # Command/message handlers
│   ├── webhook.controller.ts      # Webhook endpoint
│   ├── constants/
│   │   ├── buttons.const.ts       # Button definitions
│   │   └── scenes.const.ts        # Scene configurations
│   └── conversations/              # Conversation handlers
│       ├── base.conversation.ts
│       ├── start.conversation.ts
│       ├── home.conversation.ts
│       ├── connect.conversation.ts
│       ├── status.conversation.ts
│       ├── question.conversation.ts
│       ├── get-access.conversation.ts
│       ├── payment.conversation.ts
│       ├── month-tariff.conversation.ts
│       ├── threemonth-tariff.conversation.ts
│       ├── sixmonth-tariff.conversation.ts
│       └── conversations-registry.service.ts
│
├── payment/                       # Payment processing
├── user/                          # User management
├── tariff/                        # Tariff management
├── outline/                       # Outline VPN integration
├── prisma/                        # Database layer
└── main-grammy.ts                 # Application entry point
```

---

## 🤖 Bot Commands

### User Commands

- `/start` - Initialize bot and create user account
- Navigation via inline keyboards

### Admin Commands

- `/tariff <name> <price>` - Update tariff pricing
  - Example: `/tariff MONTH_TARIFF 300`
- `/up <username> <amount>` - Manually adjust user balance
  - Example: `/up @username 100`
- `/setmenu` - Configure web app menu button

---

## 🎯 Features

### User Features

- **🔐 VPN Access Management**
  - Automatic Outline VPN key creation
  - Fast connection links for iOS and Android
  - Connection limit enforcement

- **💳 Payment Processing**
  - YooMoney integration (Russian payment cards)
  - Multiple tariff plans (30 days, 3 months, 6 months)
  - Automatic balance updates
  - Payment webhook validation

- **📊 Status Tracking**
  - Balance monitoring
  - Connection count
  - Payment history

- **🌐 Conversation-Based Navigation**
  - Intuitive scene-based flows
  - Session persistence
  - Error handling

### Admin Features

- **💰 Balance Management**
  - Manual balance adjustments
  - Balance change audit trail

- **📈 Tariff Management**
  - Dynamic price updates
  - Multiple subscription periods

- **📬 Notifications**
  - Payment success alerts
  - Insufficient balance warnings

---

## 🔧 grammY Architecture

### Context Flow

```
User Update → GrammYService → Bot Handlers → Conversations
                     ↓
              Session Management
                     ↓
              Service Injection
```

### Conversation Pattern

```typescript
export async function myConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext
) {
  // Send message
  await ctx.reply('Hello!');

  // Wait for user response
  const response = await conversation.waitForCallbackQuery();

  // Process and navigate
  await conversation.external(() => ctx.conversation.enter('next'));
}
```

### Middleware Stack

1. **Session** - Manages user session data
2. **Hydrate** - Provides ctx.msg, ctx.chat shortcuts
3. **Conversations** - Enables conversation flows
4. **Custom** - Service injection into context

---

## 🗄️ Database Schema

### Key Models

- **User** - Telegram users with balance and connection limits
- **Connection** - VPN connections with Outline keys
- **Payment** - Payment tracking and status
- **Tariff** - Subscription plans
- **BalanceChange** - Audit trail for balance modifications

See [src/prisma/schema.prisma](src/prisma/schema.prisma) for full schema.

---

## 🚀 Deployment

### Using Webhook (Recommended for Production)

1. Ensure your server has HTTPS
2. Set `NODE_ENV=production` in `.env`
3. Run `npm run webhook:set`
4. Start server: `npm run start:prod`

### Using Polling (Development Only)

1. Set `NODE_ENV=development` in `.env`
2. Run: `npm run start:dev`

---

## 📚 Development Guide

### Adding a New Conversation

1. Create conversation file: `src/grammy/conversations/my-scene.conversation.ts`
2. Implement conversation function
3. Register in `conversations-registry.service.ts`
4. Add button in `buttons.const.ts`
5. Add scene config in `scenes.const.ts`
6. Export from `conversations/index.ts`

### Adding a New Service

1. Services are automatically available in conversations via context injection
2. Add service to `ConversationsRegistryService.injectServicesIntoContext()`
3. Access in conversation: `const myService: MyService = (ctx as any).myService`

---

## 🧪 Testing

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:cov

# E2E tests
npm run test:e2e
```

---

## 📊 Database Management

```bash
# Open Prisma Studio
npm run prisma:studio

# Create migration
npm run prisma:migrate

# Deploy migrations
npm run prisma:migrate:deploy

# Generate client
npm run prisma:generate
```

---

## 🔒 Security Notes

### Current Issues

1. **TLS Verification Disabled** - `NODE_TLS_REJECT_UNAUTHORIZED = '0'` in [main-grammy.ts](src/main-grammy.ts)
   - ⚠️ Should be fixed in production

2. **CORS Wide Open** - Allows all origins
   - ⚠️ Should be restricted to specific domains

3. **No Rate Limiting** - Commands not rate-limited
   - ⚠️ Consider adding rate limiting middleware

### Security Features

- ✅ Admin commands protected by chat ID verification
- ✅ Connection hash IDs use HMAC-SHA256
- ✅ Webhook validation with secret token
- ✅ Payment link expiration (10 minutes)
- ✅ Audit trail for all balance changes

---

## 🐛 Troubleshooting

### Bot not responding

1. Check bot token in `.env`
2. Verify bot is running: `npm run start:dev`
3. Check logs for errors

### Webhook not working

1. Verify HTTPS is properly configured
2. Check webhook info: `npm run webhook:set`
3. Ensure `TELEGRAM_SECRET_TOKEN` matches
4. Check server logs at `/telegram/webhook`

### Database issues

1. Regenerate Prisma client: `npm run prisma:generate`
2. Check migrations: `npm run prisma:migrate`
3. Verify DATABASE_URL in `.env`

---

## 📖 Documentation

- **Migration Guide**: [MIGRATION-GUIDE.md](MIGRATION-GUIDE.md)
- **Architecture**: [migration-plan.md](migration-plan.md)
- **Scene Logic**: [docs/scenes-logic.md](docs/scenes-logic.md)
- **grammY Docs**: https://grammy.dev
- **NestJS Docs**: https://nestjs.com

---

## 🤝 Contributing

This is a private project, but PRs are welcome for:

- Bug fixes
- Performance improvements
- Documentation updates
- Security enhancements

---

## 📝 License

MIT

---

## 🙋 Support

For issues or questions:

1. Check [MIGRATION-GUIDE.md](MIGRATION-GUIDE.md)
2. Review conversation examples in `src/grammy/conversations/`
3. Check grammY documentation at https://grammy.dev
4. Open an issue with detailed logs

---

## ⚡ Performance

Expected improvements with grammY over Telegraf:

- **Memory Usage**: ~15-20% reduction
- **Response Time**: Faster callback query handling
- **Bundle Size**: Smaller production bundle
- **Type Safety**: Better compile-time error detection

---

## 🎉 Credits

Built with:

- [grammY](https://grammy.dev) - Modern Telegram Bot Framework
- [NestJS](https://nestjs.com) - Progressive Node.js Framework
- [Prisma](https://prisma.io) - Next-generation ORM
- [Outline VPN](https://getoutline.org) - Open-source VPN

---

**Happy Bot Building! 🚀**