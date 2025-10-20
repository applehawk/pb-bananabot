# Getting Started with grammY Version

Quick setup guide for the newly migrated grammY-based BananaBot.

---

## 🚦 Step-by-Step Setup

### Step 1: Install Dependencies

```bash
# Option A: Use the grammY package.json
cp package-grammy.json package.json
npm install

# Option B: Install manually
npm install grammy @grammyjs/conversations @grammyjs/hydrate @grammyjs/menu
npm uninstall telegraf nestjs-telegraf
```

### Step 2: Configure Environment

Ensure your `.env` file has these variables:

```env
# Required
BOT_TOKEN=your_telegram_bot_token
ADMIN_CHAT_ID=your_telegram_user_id
OUTLINE_API_URL=https://your-outline-server.com:port/api-key/
DOMAIN=your-domain.com
DATABASE_URL=file:./src/prisma/dev.db
YOOMONEY_SECRET=your_yoomoney_secret
MINIMUM_BALANCE=3

# Optional
ADMIN_CHAT_ID_2=second_admin_id
TELEGRAM_SECRET_TOKEN=random_secret_for_webhook
PORT=80
NODE_ENV=development
```

### Step 3: Database Setup

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# (Optional) Open Prisma Studio to inspect database
npm run prisma:studio
```

### Step 4: Start Development Server

```bash
# Start in polling mode (development)
npm run start:dev

# You should see:
# 🚀 BananaBot (grammY) running on port 80
# 📡 Mode: development
# Bot started: @YourBotName (123456789)
```

### Step 5: Test the Bot

Open Telegram and:

1. Send `/start` to your bot
2. You should see the welcome message with download links
3. Click any button to test navigation

---

## 🔧 Development Mode vs Production Mode

### Development (Polling)

```bash
# .env
NODE_ENV=development

# Start
npm run start:dev

# Bot will poll Telegram for updates
# No webhook needed
# Perfect for local development
```

### Production (Webhook)

```bash
# .env
NODE_ENV=production
DOMAIN=your-domain.com
TELEGRAM_SECRET_TOKEN=your_random_secret

# Build
npm run build:grammy

# Set webhook
npm run webhook:set

# Start
npm run start:prod

# Bot will receive updates via webhook at:
# https://your-domain.com/telegram/webhook
```

---

## 📝 Quick Reference

### File Structure

```
src/grammy/                 ← All grammY code here
├── bot.module.ts           ← Main module
├── grammy.service.ts       ← Bot lifecycle
├── bot.update.ts           ← Command handlers
├── bot.service.ts          ← High-level operations
├── conversations/          ← All scene logic
│   ├── start.conversation.ts
│   ├── home.conversation.ts
│   └── ...
└── constants/
    ├── buttons.const.ts    ← Button definitions
    └── scenes.const.ts     ← Scene configs
```

### Important Commands

```bash
# Development
npm run start:dev           # Start with hot reload

# Production
npm run build:grammy        # Build for production
npm run webhook:set         # Configure webhook
npm run start:prod          # Start production

# Database
npm run prisma:generate     # Generate Prisma client
npm run prisma:migrate      # Run migrations
npm run prisma:studio       # Open database GUI

# Utilities
npm run lint                # Lint code
npm run format              # Format code
npm run test                # Run tests
```

---

## 🐛 Common Issues & Solutions

### Issue: Bot not responding

**Solution:**
```bash
# Check if bot is running
npm run start:dev

# Check logs for errors
# Verify BOT_TOKEN in .env
# Ensure bot is not blocked by user
```

### Issue: "Conversation not found"

**Solution:**
```bash
# Verify conversation is registered in:
# src/grammy/conversations/conversations-registry.service.ts

# Check conversation name matches CommandEnum value
```

### Issue: Database errors

**Solution:**
```bash
# Regenerate Prisma client
npm run prisma:generate

# Reset database (⚠️ deletes all data)
rm src/prisma/dev.db
npm run prisma:migrate
```

### Issue: Webhook not working

**Solution:**
```bash
# Verify HTTPS is configured on your server
# Check webhook status
npm run webhook:set

# View webhook info
curl https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo

# Delete webhook (fall back to polling)
curl https://api.telegram.org/bot<BOT_TOKEN>/deleteWebhook
```

### Issue: TypeScript errors

**Solution:**
```bash
# Install missing types
npm install --save-dev @types/node @types/express

# Clear build cache
rm -rf dist
npm run build:grammy
```

---

## 📚 Learning Resources

### grammY Documentation

- **Getting Started**: https://grammy.dev/guide/getting-started.html
- **Conversations**: https://grammy.dev/plugins/conversations.html
- **Context**: https://grammy.dev/guide/context.html
- **Sessions**: https://grammy.dev/plugins/session.html

### Project Documentation

- **[README-GRAMMY.md](README-GRAMMY.md)** - Full documentation
- **[MIGRATION-GUIDE.md](MIGRATION-GUIDE.md)** - Migration details
- **[MIGRATION-SUMMARY.md](MIGRATION-SUMMARY.md)** - What was changed

### Code Examples

Look at existing conversations in `src/grammy/conversations/`:
- Simple: `question.conversation.ts`, `status.conversation.ts`
- Complex: `payment.conversation.ts`, `connect.conversation.ts`

---

## 🎯 Testing Workflow

### 1. Test Basic Commands

```
/start              → Should show welcome + download links
/tariff <name> <price> → Should update tariff (admin only)
/up <username> <amount> → Should adjust balance (admin only)
```

### 2. Test Navigation

```
Click "ℹ️ Статус"      → Should show user status
Click "⚡ Подключиться" → Should create VPN connection
Click "🔥 Купить"      → Should show tariffs
Click "❓ Помощь"      → Should show help
```

### 3. Test Payment Flow

```
1. Click "🔥 Купить"
2. Select a tariff (e.g., "30 дней")
3. Click "💳 картой РФ"
4. Should receive payment link
5. Link should expire after 10 minutes
```

### 4. Test Admin Commands

```
/tariff MONTH_TARIFF 250  → Should update tariff price
/up @username 100         → Should add 100 to user balance
```

---

## 🔍 Debugging Tips

### Enable Verbose Logging

In `src/grammy/grammy.service.ts`, add:

```typescript
bot.use((ctx, next) => {
  console.log('Update:', JSON.stringify(ctx.update, null, 2));
  return next();
});
```

### Inspect Session Data

In any conversation:

```typescript
console.log('Session:', ctx.session);
```

### Check Conversation State

```typescript
console.log('Current conversation:', ctx.conversation.active);
```

### Monitor Database

```bash
# Open Prisma Studio
npm run prisma:studio

# Or use SQLite CLI
sqlite3 src/prisma/dev.db
.tables
SELECT * FROM User;
```

---

## 🚀 Ready to Go?

Follow this checklist:

- [ ] `.env` file configured
- [ ] Dependencies installed (`npm install`)
- [ ] Prisma client generated (`npm run prisma:generate`)
- [ ] Database migrated (`npm run prisma:migrate`)
- [ ] Bot started (`npm run start:dev`)
- [ ] `/start` command works in Telegram
- [ ] Navigation buttons work
- [ ] VPN connection creation works
- [ ] Payment flow works
- [ ] Admin commands work

If all checked, you're ready! 🎉

---

## 💡 Next Steps

After successful setup:

1. **Customize Messages**
   - Edit `src/grammy/constants/scenes.const.ts`
   - Update text and button labels

2. **Add New Features**
   - Create new conversation in `src/grammy/conversations/`
   - Register in `conversations-registry.service.ts`
   - Add button in `buttons.const.ts`

3. **Improve Security**
   - Fix TLS verification in `main-grammy.ts`
   - Restrict CORS to specific domains
   - Add rate limiting

4. **Deploy to Production**
   - Set up HTTPS
   - Configure webhook
   - Set NODE_ENV=production
   - Monitor logs

---

## 📞 Need Help?

1. Check [README-GRAMMY.md](README-GRAMMY.md) for detailed docs
2. Review [MIGRATION-GUIDE.md](MIGRATION-GUIDE.md) for examples
3. Check grammY docs at https://grammy.dev
4. Look at example conversations in `src/grammy/conversations/`

---

**Happy coding! 🎉**