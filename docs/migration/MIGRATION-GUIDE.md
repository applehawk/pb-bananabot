# Telegraf → grammY Migration Guide

## Overview

This document describes the complete migration from **Telegraf/nestjs-telegraf** to **grammY** for the BananaBot VPN Telegram bot.

**Migration Date**: 2025-10-20
**Target grammY Version**: 1.21.1
**Previous Telegraf Version**: 4.15.3

---

## Why Migrate to grammY?

1. **Better TypeScript Support**: grammY is written in TypeScript from the ground up with superior type inference
2. **Modern Architecture**: Built-in support for conversations, middleware, and plugins
3. **Active Development**: More frequent updates and better documentation
4. **Performance**: More efficient update processing and memory usage
5. **Plugin Ecosystem**: Rich ecosystem with official plugins for sessions, conversations, menus, etc.

---

## Architecture Changes

### Old Structure (Telegraf)
```
src/
├── bot.module.ts          # TelegrafModule.forRootAsync()
├── bot.update.ts          # @Update() with decorators
├── bot.service.ts         # InjectBot(BOT_NAME)
├── interfaces/
│   └── context.interface.ts
├── abstract/
│   └── abstract.scene.ts  # Base scene class
└── scenes/
    ├── start.scene.ts     # @Scene() decorator
    ├── home.scene.ts
    └── ...
```

### New Structure (grammY)
```
src/
├── grammy/
│   ├── grammy.module.ts          # GrammY module
│   ├── grammy.service.ts         # Bot lifecycle
│   ├── grammy-context.interface.ts
│   ├── bot.module.ts             # Main app module
│   ├── bot.service.ts            # High-level bot operations
│   ├── bot.update.ts             # Command/message handlers
│   ├── webhook.controller.ts     # Webhook endpoint
│   ├── constants/
│   │   ├── buttons.const.ts      # Button definitions
│   │   └── scenes.const.ts       # Scene configs
│   └── conversations/
│       ├── base.conversation.ts
│       ├── conversations-registry.service.ts
│       ├── start.conversation.ts
│       ├── home.conversation.ts
│       └── ...
└── main-grammy.ts                # Bootstrap file
```

---

## Key Migrations

### 1. Context Interface

**Telegraf:**
```typescript
import { Context as BaseContext, Scenes } from 'telegraf';

export interface Context extends BaseContext {
  session: SessionData;
  scene: Scenes.SceneContextScene<Context, SceneSession>;
}
```

**grammY:**
```typescript
import { Context, SessionFlavor } from 'grammy';
import { ConversationFlavor } from '@grammyjs/conversations';

export interface MyContext extends Context, SessionFlavor<SessionData>, ConversationFlavor {}
```

### 2. Bot Initialization

**Telegraf:**
```typescript
TelegrafModule.forRootAsync({
  botName: BOT_NAME,
  useFactory: (configService) => ({
    token: process.env.BOT_TOKEN,
    middlewares: [session(), commandArgs()],
  }),
})
```

**grammY:**
```typescript
@Injectable()
export class GrammYService implements OnModuleInit, OnModuleDestroy {
  public bot: Bot<MyContext>;

  constructor(private configService: ConfigService) {
    this.bot = new Bot<MyContext>(configService.get('BOT_TOKEN'));
    this.setupMiddlewares();
  }

  private setupMiddlewares() {
    this.bot.use(session({ initial: () => ({}) }));
    this.bot.use(hydrate());
    this.bot.use(conversations());
  }
}
```

### 3. Command Handlers

**Telegraf:**
```typescript
@Update()
export class BotUpdate {
  @Start()
  async onStart(@Ctx() ctx: Context) {
    await ctx.scene.enter(CommandEnum.START);
  }

  @Command('tariff')
  async changeTariff(@Ctx() ctx: Context) {
    const [tariffName, price] = ctx.state.command.args;
  }
}
```

**grammY:**
```typescript
@Injectable()
export class BotUpdate implements OnModuleInit {
  async onModuleInit() {
    const bot = this.grammyService.bot;

    bot.command('start', async (ctx) => {
      await ctx.conversation.enter('start');
    });

    bot.command('tariff', async (ctx) => {
      const args = ctx.match?.split(' ').filter(Boolean) || [];
      const [tariffName, priceStr] = args;
    });
  }
}
```

### 4. Scenes → Conversations

**Telegraf:**
```typescript
@Scene(CommandEnum.START)
export class StartScene extends AbstractScene {
  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    await ctx.reply('Welcome!');
  }
}
```

**grammY:**
```typescript
export async function startConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext
) {
  await ctx.reply('Welcome!');

  // Wait for user input
  const response = await conversation.waitForCallbackQuery();

  // Navigate to another conversation
  await conversation.external(() => ctx.conversation.enter('home'));
}
```

### 5. Inline Keyboards

**Telegraf:**
```typescript
import { Markup } from 'telegraf';

const buttons = Markup.inlineKeyboard([
  [Markup.button.callback('Button 1', 'data1')],
  [Markup.button.url('Link', 'https://example.com')]
]);
```

**grammY:**
```typescript
import { InlineKeyboard } from 'grammy';

const keyboard = new InlineKeyboard()
  .text('Button 1', 'data1').row()
  .url('Link', 'https://example.com');
```

### 6. Callback Query Handling

**Telegraf:**
```typescript
@Action(/.*/)
async onAnswer(@Ctx() ctx: SceneContext) {
  const data = ctx.callbackQuery.data;
  await ctx.scene.enter(data);
}
```

**grammY:**
```typescript
bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data;
  await ctx.answerCallbackQuery();
  await ctx.conversation.enter(data);
});
```

---

## Dependency Changes

### Remove
```json
"dependencies": {
  "nestjs-telegraf": "^2.7.0",
  "telegraf": "^4.15.3"
}
```

### Add
```json
"dependencies": {
  "grammy": "^1.21.1",
  "@grammyjs/conversations": "^1.2.0",
  "@grammyjs/hydrate": "^1.4.1",
  "@grammyjs/menu": "^1.2.2",
  "@grammyjs/runner": "^2.0.3",
  "@grammyjs/storage-free": "^2.4.2",
  "@grammyjs/transformer-throttler": "^1.2.1"
}
```

---

## Migration Steps

### 1. Install grammY Dependencies

```bash
npm install grammy @grammyjs/conversations @grammyjs/hydrate @grammyjs/menu @grammyjs/runner @grammyjs/storage-free @grammyjs/transformer-throttler
```

### 2. Run the grammY Version

The old Telegraf version is preserved in `src/` directory.
The new grammY version is in `src/grammy/` directory.

**Development (polling):**
```bash
npm run start:dev:grammy
```

**Production (webhook):**
```bash
# Set webhook first
npx ts-node scripts/set-webhook.ts

# Start server
npm run start:prod:grammy
```

### 3. Update package.json Scripts

Add these scripts:
```json
{
  "scripts": {
    "start:dev:grammy": "nest start --watch --entryFile main-grammy",
    "start:prod:grammy": "node dist/main-grammy",
    "build:grammy": "nest build --entryFile main-grammy",
    "webhook:set": "ts-node scripts/set-webhook.ts"
  }
}
```

### 4. Environment Variables

No changes needed. Same `.env` variables:
- `BOT_TOKEN`
- `ADMIN_CHAT_ID`
- `OUTLINE_API_URL`
- `DOMAIN`
- `DATABASE_URL`
- `YOOMONEY_SECRET`
- `TELEGRAM_SECRET_TOKEN` (optional, for webhook security)

---

## Testing Checklist

- [ ] `/start` command creates user and shows welcome screen
- [ ] Navigation buttons work (Status, Connect, Get Access, Question)
- [ ] Tariff selection stores tariffId in session
- [ ] Payment flow creates payment and shows payment link
- [ ] Admin commands work (`/tariff`, `/up`)
- [ ] Balance checks prevent connection creation when insufficient
- [ ] Connection creation generates proper Outline links
- [ ] Webhook receives updates correctly (production)
- [ ] Session persists across updates
- [ ] Error handling works correctly

---

## Breaking Changes

### 1. No Decorator-Based Handlers

Telegraf's `@Update()`, `@Command()`, `@Action()` decorators are replaced with direct bot method calls in `onModuleInit()`.

### 2. Scene System → Conversations

The scene-based navigation is replaced with grammY conversations:
- `ctx.scene.enter()` → `ctx.conversation.enter()`
- `@SceneEnter()` → async function with `Conversation` parameter
- Scene state → Session data

### 3. Context API Differences

Some context properties/methods have different names:
- `ctx.telegram.sendMessage()` → `ctx.api.sendMessage()`
- `ctx.answerCbQuery()` → `ctx.answerCallbackQuery()`
- `ctx.editMessageText()` → `ctx.api.editMessageText()`

### 4. Middleware Order Matters

In grammY, middleware must be registered in correct order:
1. Session (must be first)
2. Hydrate
3. Conversations
4. Custom middleware

---

## Rollback Plan

If issues occur, you can rollback to Telegraf:

1. Use the original `src/main.ts` entry point
2. Keep the old `src/bot.module.ts`
3. Remove grammY dependencies
4. Restore Telegraf dependencies

The old code is preserved and functional.

---

## Performance Improvements

Expected improvements with grammY:

1. **Memory Usage**: ~15-20% reduction due to more efficient update processing
2. **Response Time**: Faster callback query handling
3. **Bundle Size**: Smaller production bundle
4. **Type Safety**: Compile-time error detection

---

## Resources

- **grammY Docs**: https://grammy.dev
- **grammY GitHub**: https://github.com/grammyjs/grammY
- **Examples**: https://github.com/grammyjs/examples
- **Migration Guide**: https://grammy.dev/guide/migration.html

---

## Support

For issues or questions:
1. Check grammY documentation
2. Review conversation examples in `src/grammy/conversations/`
3. Check migration logs in this document

---

## Conclusion

This migration brings modern bot development practices to the BananaBot project:
- Better type safety
- Cleaner code organization
- More maintainable conversation flows
- Active community and support

The new architecture is more scalable and easier to extend with new features.