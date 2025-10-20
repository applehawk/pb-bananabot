# Telegraf Usage & Scenes Logic Documentation

## Overview

This document provides a comprehensive analysis of all Telegraf usage in the BananaBot project, including scene implementations, decorators, and conversation flows.

**Last Updated**: 2025-10-20
**Framework**: Telegraf via `nestjs-telegraf`

---

## Table of Contents

1. [Telegraf Integration Setup](#telegraf-integration-setup)
2. [Core Bot Handler (BotUpdate)](#core-bot-handler-botupdate)
3. [Scene Architecture](#scene-architecture)
4. [Scene Implementations](#scene-implementations)
5. [Button Definitions](#button-definitions)
6. [Scene Navigation Flow](#scene-navigation-flow)
7. [Context Interface](#context-interface)
8. [Middlewares](#middlewares)
9. [Best Practices & Patterns](#best-practices--patterns)

---

## Telegraf Integration Setup

### Module Configuration

**File**: [src/bot.module.ts](src/bot.module.ts)

```typescript
@Module({
  imports: [
    TelegrafModule.forRootAsync({
      botName: BOT_NAME,
      useFactory: (configService: ConfigService) => ({
        token: configService.get<string>('BOT_TOKEN'),
        middlewares: [session(), commandArgs()],
        include: [BotModule],
      }),
      inject: [ConfigService],
    }),
    // ... other imports
  ],
})
export class BotModule {}
```

**Key Configuration**:
- `botName`: Identifier for bot injection
- `token`: From environment variable `BOT_TOKEN`
- `middlewares`:
  - `session()` - Enables session storage for conversation state
  - `commandArgs()` - Parses command arguments (e.g., `/tariff MONTH_TARIFF 299`)
- `include`: Modules that can use bot decorators

---

## Core Bot Handler (BotUpdate)

**File**: [src/bot.update.ts](src/bot.update.ts)

### Class Declaration

```typescript
@UseInterceptors(ResponseTimeInterceptor)
@UseFilters(AllExceptionFilter)
@Update()
export class BotUpdate {
  constructor(
    @InjectBot(BOT_NAME) private readonly bot: Telegraf<Context>,
    private readonly botService: BotService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly tariffService: TariffService
  ) {
    this.adminChatId = Number(configService.get('ADMIN_CHAT_ID'));
  }
}
```

**Decorators**:
- `@Update()` - Marks class as Telegraf update handler (main bot controller)
- `@UseInterceptors(ResponseTimeInterceptor)` - Logs response times
- `@UseFilters(AllExceptionFilter)` - Global error handling

**Bot Injection**: `@InjectBot(BOT_NAME)` provides access to Telegraf instance

---

### Command Handlers

#### 1. `/start` Command

**Decorator**: `@Start()`

**File**: [src/bot.update.ts:34-51](src/bot.update.ts#L34-L51)

```typescript
@Start()
async onStart(@Ctx() ctx: Context & { update: any }) {
  const message = ctx.update.message;

  // Only work in private chats
  if (!['private'].includes(message.chat.type)) {
    await ctx.reply('Для работы с ботом, нужно писать ему в личные сообщения', {
      reply_markup: { remove_keyboard: true },
    });
    return;
  }

  ctx.session.messageId = undefined;

  // Create or update user in database
  await this.botService.upsertUser(ctx);

  // Enter START scene
  await ctx.scene.enter(CommandEnum.START);
}
```

**Flow**:
1. Check if chat type is private
2. Clear session message ID
3. Upsert user to database
4. Navigate to `START` scene

**Entry Point**: User sends `/start` command or clicks "Start" button

---

#### 2. `/tariff` Command (Admin Only)

**Decorator**: `@Command('tariff')`

**File**: [src/bot.update.ts:85-93](src/bot.update.ts#L85-L93)

```typescript
@Command('tariff')
async changeTariff(@Ctx() ctx: Context & { update: any }) {
  if (this.isAdmin(ctx)) {
    const [tariffName, price] = ctx.state.command.args;

    if (!(tariffName && price) || Number.isNaN(parseInt(price)))
      throw new Error('Не указан один из обязательных параметров или указан неверно!');

    await this.tariffService.updateTariffPrice(tariffName, parseInt(price));
  }
}
```

**Usage**: `/tariff MONTH_TARIFF 299`

**Flow**:
1. Check admin privileges
2. Parse arguments (tariff name and new price)
3. Validate parameters
4. Update tariff price in database

**Admin Check**: Compares `ctx.chat.id` with `ADMIN_CHAT_ID` from env

---

#### 3. `/up` Command (Admin Only)

**Decorator**: `@Command('up')`

**File**: [src/bot.update.ts:108-121](src/bot.update.ts#L108-L121)

```typescript
@Command('up')
async onBalanceUpCommand(@Ctx() ctx: Context & { update: any }) {
  if (this.isAdmin(ctx)) {
    const [username, change] = ctx.state.command.args;

    if (!(username && change) || Number.isNaN(parseInt(change)))
      throw new Error('Не указан один из обязательных параметров или указан неверно!');

    const changeInt: number = parseInt(change);

    const balanceChange = await this.userService.findUserByUsername(username)
      .then(user => this.userService.commitBalanceChange(user, changeInt, BalanceChangeTypeEnum.MANUALLY));

    await this.bot.telegram.sendMessage(
      this.adminChatId,
      `Пополнен баланс на ${balanceChange.changeAmount}, статус пополнения: ${balanceChange.status}`
    );
  }
}
```

**Usage**: `/up john_doe 500`

**Flow**:
1. Check admin privileges
2. Parse username and balance change amount
3. Find user by username
4. Commit balance change with type `MANUALLY`
5. Send status notification to admin

---

### Action Handlers

#### Global Action Handler

**Decorator**: `@Action(/.*/)` - Matches all callback query data

**File**: [src/bot.update.ts:53-64](src/bot.update.ts#L53-L64)

```typescript
@Action(/.*/)
async onAnswer(@Ctx() ctx: SceneContext & { update: any }) {
  this.logger.log(ctx);

  try {
    const cbQuery = ctx.update.callback_query;

    // Only private chats
    if (!['private'].includes(cbQuery.message.chat.type)) return;

    const nextStep = 'data' in cbQuery ? cbQuery.data : null;

    // Enter scene corresponding to callback data
    await ctx.scene.enter(nextStep);
  } catch (e) {
    this.logger.log(e);
  }
}
```

**Purpose**: Routes all inline button clicks to corresponding scenes

**Flow**:
1. Extract callback data from button click
2. Use callback data as scene name
3. Navigate to that scene

**Example**: User clicks "30 дней" button → `cbQuery.data === "MONTH_TARIFF"` → enters `MONTH_TARIFF` scene

---

### Text Message Handlers

#### 1. Home Button Handler

**Decorator**: `@Hears(BUTTONS[CommandEnum.HOME].text)`

**File**: [src/bot.update.ts:66-83](src/bot.update.ts#L66-L83)

```typescript
@Hears(BUTTONS[CommandEnum.HOME].text)
async onMenuHears(@Ctx() ctx: Context & { update: any }) {
  const message = ctx.update.message;

  if (!['private'].includes(message.chat.type)) return;

  try {
    this.logger.log('hears', ctx.message);

    const existUser = await this.userService.findOneByUserId(ctx.from.id);

    if (existUser) {
      ctx.scene.enter(CommandEnum.HOME);
    } else {
      ctx.scene.enter(CommandEnum.START);
    }
  } catch (e) {
    this.logger.log(e);
  }
}
```

**Trigger**: User clicks "📱в меню" keyboard button

**Flow**:
1. Check if user exists in database
2. If exists → navigate to `HOME` scene
3. If not exists → navigate to `START` scene

---

#### 2. Global Text Handler

**Decorator**: `@Hears(/.*/)` - Matches all text messages

**File**: [src/bot.update.ts:123-140](src/bot.update.ts#L123-L140)

```typescript
@Hears(/.*/)
async onHears(@Ctx() ctx: Context & { update: any }) {
  this.logger.log("onHears");

  const user = await this.userService.findOneByUserId(ctx.from.id);

  // Update chatId if missing
  if (user && !user.chatId) {
    await this.userService.updateUser({
      where: { userId: user.userId },
      data: { chatId: ctx.chat.id }
    });
  }

  try {
    const message = ctx.update.message;

    // Find button matching text
    const [command] = Object.entries(BUTTONS).find(
      ([_, button]) => button.text === message.text
    );

    if (!['private'].includes(message.chat.type)) return;

    this.logger.log('stats', ctx.message);

    // Navigate to scene matching button command
    ctx.scene.enter(command);
  } catch (e) {
    this.logger.log(e);
  }
}
```

**Purpose**: Catch-all handler for keyboard button presses

**Flow**:
1. Update user's chatId if missing
2. Find button definition matching message text
3. Extract command from button
4. Navigate to corresponding scene

---

### Helper Methods

#### Admin Check

```typescript
private isAdmin(ctx: Context): boolean {
  return ctx.chat.id === this.adminChatId;
}
```

**Usage**: Protects admin-only commands (`/tariff`, `/up`)

---

## Scene Architecture

### Base Class: AbstractScene

**File**: [src/abstract/abstract.scene.ts](src/abstract/abstract.scene.ts)

```typescript
export class AbstractScene {
  public logger = new Logger(AbstractScene.name);

  async sceneReply(@Ctx() ctx: Context, scene) {
    // Keyboard buttons with navigate text
    if (scene.navigateButtons && scene.navigateText) {
      await ctx.replyWithHTML(
        scene.navigateText,
        Markup.keyboard(scene.navigateButtons).resize()
      );
    }

    // Plain text (no buttons)
    if (!scene.navigateButtons && !scene.buttons) {
      if (scene.text) {
        await ctx.replyWithHTML(scene.text);
      } else {
        await ctx.replyWithHTML(scene.navigateText);
      }
    }

    // Inline buttons with text
    if (scene.buttons && scene.text) {
      await ctx.replyWithHTML(scene.text, Markup.inlineKeyboard(scene.buttons));
    }
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    this.logger.log(ctx.scene.session.current);
    const scene = SCENES[ctx.scene.session.current];
    await this.sceneReply(ctx, scene);
  }

  @SceneLeave()
  async onSceneLeave(@Ctx() ctx: Context) {
    this.logger.log(ctx.scene.session.current);
  }
}
```

**Key Features**:
1. **@SceneEnter()** - Lifecycle hook triggered when entering scene
2. **@SceneLeave()** - Lifecycle hook triggered when leaving scene
3. **sceneReply()** - Renders scene content with appropriate buttons
4. All scenes extend this base class

**Scene Configuration Pattern**:
- Scenes are defined in `SCENES` constant ([src/constants/scenes.const.ts](src/constants/scenes.const.ts))
- Base class looks up scene config by `ctx.scene.session.current`
- Automatically renders scene on enter

---

## Scene Implementations

### 1. START Scene

**File**: [src/scenes/start.scene.ts](src/scenes/start.scene.ts)

**Decorator**: `@Scene(CommandEnum.START)`

```typescript
@Scene(CommandEnum.START)
export class StartScene extends AbstractScene {}
```

**Implementation**: Uses default `AbstractScene` behavior

**Configuration**: [src/constants/scenes.const.ts:22-43](src/constants/scenes.const.ts#L22-L43)

```typescript
[CommandEnum.START]: {
  text: `Чтобы подключиться к VPN нужно:
  Скачать приложение Outline на свой телефон:
    Apple: https://apps.apple.com/us/app/outline-app/id1356177741
    Android (ссылка 1): https://play.google.com/store/apps/details?id=org.outline.android.client
    Android (ссылка 2): https://s3.amazonaws.com/outline-releases/client/android/stable/Outline-Client.apk
  если не работает для Android ссылка 1, используйте ссылку 2.`,
  buttons: [
    [BUTTONS[CommandEnum.OUTLINE_APPLE], BUTTONS[CommandEnum.OUTLINE_ANDROID]]
  ],
  navigateText: `👋🏻 Привет!

  Это Telegram-бот для подключения к VPN.

  Доступны локации:
├ 🇳🇱 Нидерланды`,
  navigateButtons: [
    [BUTTONS[CommandEnum.STATUS], BUTTONS[CommandEnum.CONNECT]],
    [BUTTONS[CommandEnum.GET_ACCESS], BUTTONS[CommandEnum.QUESTION]]
  ]
}
```

**Flow**:
1. Display welcome message with Outline app download links
2. Show inline buttons for app stores
3. Show main menu keyboard buttons

**Entry Points**:
- `/start` command
- New user onboarding

**Exit Points**:
- User clicks app store buttons (external links)
- User clicks keyboard buttons → navigate to respective scenes

---

### 2. HOME Scene

**File**: [src/scenes/home.scene.ts](src/scenes/home.scene.ts)

**Decorator**: `@Scene(CommandEnum.HOME)`

```typescript
@Scene(CommandEnum.HOME)
export class HomeScene extends AbstractScene {}
```

**Implementation**: Uses default `AbstractScene` behavior

**Configuration**: [src/constants/scenes.const.ts:10-21](src/constants/scenes.const.ts#L10-L21)

```typescript
[CommandEnum.HOME]: {
  navigateText: `👋🏻 Привет!

  Это Telegram-бот для подключения к VPN.

  Доступны локации:
├ 🇳🇱 Нидерланды`,
  navigateButtons: [
    [BUTTONS[CommandEnum.STATUS], BUTTONS[CommandEnum.CONNECT]],
    [BUTTONS[CommandEnum.GET_ACCESS], BUTTONS[CommandEnum.QUESTION]]
  ]
}
```

**Flow**:
1. Display welcome message
2. Show main menu keyboard with 4 options

**Entry Points**:
- User clicks "📱в меню" button
- After completing other scenes

**Exit Points**:
- "ℹ️ Статус" → `STATUS` scene
- "⚡ Подключиться" → `CONNECT` scene
- "🔥 Купить" → `GET_ACCESS` scene
- "❓ Помощь" → `QUESTION` scene

---

### 3. GET_ACCESS Scene

**File**: [src/scenes/get-access.scene.ts](src/scenes/get-access.scene.ts)

**Decorator**: `@Scene(CommandEnum.GET_ACCESS)`

```typescript
@Scene(CommandEnum.GET_ACCESS)
export class GetAccessScene extends AbstractScene {
  constructor(
    private readonly tariffService: TariffService,
    private readonly userService: UserService
  ) {
    super();
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    this.logger.log(ctx.scene.session.current);

    // Fetch all tariffs from database
    const tariffs = await this.tariffService.getAllTariffs();
    const scene = SCENES[ctx.scene.session.current];

    // Get or create user
    const user = await this.userService.findOneByUserId(ctx.from.id);
    try {
      if (!user) {
        await this.userService.createUser({
          userId: ctx.from.id,
          chatId: ctx.chat.id,
          username: ctx.from.username,
          connLimit: 1,
          balance: 0.0
        });
      }
      ctx.session.messageId = undefined;
    } catch (e) {
      this.logger.log(e);
    }

    // Format balance
    const balance = user.balance.toLocaleString('ru-RU', {
      style: 'currency',
      currency: 'RUB',
    });

    // Render scene with dynamic content
    await ctx.replyWithHTML(
      scene.navigateText,
      Markup.keyboard(scene.navigateButtons).resize()
    );
    await ctx.replyWithHTML(
      scene.text(tariffs, balance),
      Markup.inlineKeyboard(scene.buttons(tariffs))
    );
  }
}
```

**Configuration**: [src/constants/scenes.const.ts:44-55](src/constants/scenes.const.ts#L44-L55)

```typescript
[CommandEnum.GET_ACCESS]: {
  navigateText: 'Для получения доступа к VPN тебе нужно пополнить баланс по количеству дней использования.',
  navigateButtons: [BUTTONS[CommandEnum.HOME]],
  text: (tariffs: Tariff[], currentBalance: string) =>
    `Периоды пополнения:\n` +
    tariffs.map((tariff) =>
      `<b>${BUTTONS[CommandEnum[tariff.name + '_TARIFF']].text}</b>: <i>${
        tariff.period > 99999999990 ? '∞' : tariff.period
      }</i> дней. <b>${tariff.price + 'руб.'}</b>.\n`
    ).join('') + `\nТекущий баланс: ${currentBalance}\n\n`,
  buttons: (tariffs: Tariff[]) =>
    splitArrayIntoPairs(tariffs.map((tariff) => BUTTONS[CommandEnum[tariff.name + '_TARIFF']])),
}
```

**Flow**:
1. Fetch all tariffs from database
2. Get or create user
3. Display tariff options with prices and periods
4. Show current balance
5. Generate inline buttons dynamically based on available tariffs

**Entry Points**:
- User clicks "🔥 Купить" from HOME

**Exit Points**:
- User clicks tariff button (e.g., "30 дней") → `MONTH_TARIFF` scene
- User clicks "📱в меню" → `HOME` scene

**Dynamic Content**:
- `text()` function formats tariff list with current balance
- `buttons()` function generates buttons for each tariff

---

### 4. Tariff Selection Scenes

**Files**:
- [src/scenes/month-tariff.scene.ts](src/scenes/month-tariff.scene.ts)
- [src/scenes/threemonth-tariff.scene.ts](src/scenes/threemonth-tariff.scene.ts)
- [src/scenes/sixmonth-tariff.scene.ts](src/scenes/sixmonth-tariff.scene.ts)

**Decorators**: `@Scene(CommandEnum.MONTH_TARIFF)`, etc.

```typescript
@Scene(CommandEnum.MONTH_TARIFF)
export class MonthTariffScene extends AbstractScene {
  constructor(private readonly tariffService: TariffService) {
    super();
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    this.logger.log(ctx.scene.session.current);

    // Extract tariff name from scene name (e.g., "MONTH" from "MONTH_TARIFF")
    const tariff = await this.tariffService.getOneByName(
      ctx.scene.session.current.split('_')[0]
    );

    // Store selected tariff in session
    ctx.session.tariffId = tariff.id.toString();

    // Immediately navigate to payment scene
    ctx.scene.enter(CommandEnum.PAYMENT);
  }
}
```

**Flow**:
1. Extract tariff name from scene identifier
2. Fetch tariff details from database
3. Store `tariffId` in session
4. Automatically navigate to `PAYMENT` scene

**Entry Points**:
- User clicks tariff button in `GET_ACCESS` scene

**Exit Points**:
- Automatically → `PAYMENT` scene

**Purpose**: Intermediate scenes that capture tariff selection and pass it to payment flow

---

### 5. PAYMENT Scene

**File**: [src/scenes/payment.scene.ts](src/scenes/payment.scene.ts)

**Decorator**: `@Scene(CommandEnum.PAYMENT)`

```typescript
@Scene(CommandEnum.PAYMENT)
export class PaymentScene extends AbstractScene {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly tariffService: TariffService,
    private readonly userService: UserService
  ) {
    super();
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    this.logger.log(ctx.scene.session.current);
    const scene = SCENES[ctx.scene.session.current];

    // Get user balance
    const user = await this.userService.user({ userId: ctx.from.id });
    const balance = user.balance.toLocaleString('ru-RU', {
      style: 'currency',
      currency: 'RUB',
    });

    // Get selected tariff
    const tariff = await this.tariffService.getOneById(ctx.session.tariffId);
    const text = scene.text(balance, tariff.name);

    // Display payment options
    await ctx.replyWithHTML(
      scene.text(balance, tariff.name),
      Markup.inlineKeyboard(scene.buttons)
    );
  }

  @Action(CommandEnum.PAY_WITH_YOOMONEY)
  async payWithYoomoney(@Ctx() ctx: Context) {
    this.logger.log(ctx.scene.session.current);
    await this.createPaymentAndReply(ctx, PaymentSystemEnum.YOOMONEY);
  }

  @Action(CommandEnum.CONFIRM_PAYMENT)
  async confirmPayment(@Ctx() ctx: Context) {
    this.logger.log(ctx.scene.session.current);
    // Future implementation: manual payment confirmation
  }

  private async createPaymentAndReply(
    ctx: Context,
    paymentSystem: PaymentSystemEnum,
    email?: string
  ) {
    this.logger.debug(`create payment with ${paymentSystem}`);

    try {
      const { tariffId } = ctx.session;

      // Create payment via PaymentService
      const payment = await this.paymentService.createPayment(
        ctx.from.id,
        ctx.chat.id,
        tariffId,
        paymentSystem,
      );

      this.logger.debug(`payment ${JSON.stringify(payment)}`);

      // Send payment link
      const sentMessage = await ctx.sendMessage(
        `Чтобы оплатить подписку для выбранного вами тарифа, вам нужно перейти к оплате, нажав на кнопку ниже.\n\nПосле того как вы оплатите, я автоматически вам поменяю тариф.`,
        Markup.inlineKeyboard([
          [Markup.button.url(
            paymentSystem === 'WALLET' ? '👛 Pay via Wallet' : '👉 перейти к оплате',
            payment.url
          )],
        ]),
      );

      this.logger.debug(`sentMessage ${JSON.stringify(sentMessage)}`);

      // Auto-expire payment link after 10 minutes
      setTimeout(async () => {
        const chatId = ctx.chat.id;
        const messageId = sentMessage.message_id;

        await ctx.telegram.editMessageText(
          chatId,
          messageId,
          undefined,
          `Ссылка на оплату истекла. Пожалуйста, попробуйте снова, если вы хотите оплатить подписку.`,
          { parse_mode: 'HTML' },
        );
      }, 600000); // 10 minutes

    } catch (error) {
      console.log(error);
      await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте снова.');
    }
  }
}
```

**Configuration**: [src/constants/scenes.const.ts:56-68](src/constants/scenes.const.ts#L56-L68)

```typescript
[CommandEnum.PAYMENT]: {
  text: (balance: string, currentTariff: string) =>
    `
    Текущий баланс: ${balance}\n
    Выбран тариф: ${currentTariff}\n\n

    💳 К оплате принимаются карты РФ:
    Visa, MasterCard, МИР.`,
  buttons: [
    [BUTTONS[CommandEnum.PAY_WITH_YOOMONEY]],
    [BUTTONS[CommandEnum.CONFIRM_PAYMENT]]
  ]
}
```

**Flow**:
1. Display current balance and selected tariff
2. Show payment options (currently only YooMoney)
3. On button click → create payment via `PaymentService`
4. Send payment link to user
5. Auto-expire link after 10 minutes

**Entry Points**:
- Automatically from tariff scenes

**Exit Points**:
- User clicks payment link (external, opens YooMoney)
- Payment validated by scheduler → user notified

**Action Handlers**:
- `@Action(CommandEnum.PAY_WITH_YOOMONEY)` - Initiates YooMoney payment
- `@Action(CommandEnum.CONFIRM_PAYMENT)` - Placeholder for manual confirmation

---

### 6. CONNECT Scene

**File**: [src/scenes/connect.scene.ts](src/scenes/connect.scene.ts)

**Decorator**: `@Scene(CommandEnum.CONNECT)`

```typescript
@Scene(CommandEnum.CONNECT)
export class ConnectScene extends AbstractScene {
  constructor(
    private readonly outlineService: OutlineService,
    private readonly connService: ConnectionService,
    private readonly userService: UserService,
    private readonly botService: BotService
  ) {
    super();
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    const userId = ctx.from.id;
    this.logger.log(ctx.scene.session.current);

    // Check if user has sufficient balance
    const user = await this.userService.findOneByUserId(ctx.from.id);
    if (user.balance <= this.botService.minimumBalance) {
      ctx.scene.enter(CommandEnum.GET_ACCESS);
      return;
    }

    // Create new connection or get existing
    const connection = await this.outlineService.createConnection(userId, "OpenPNBot")
      .catch(reason => {
        // If creation fails, get last connection
        return this.connService.connections({ where: { userId: userId }})
          .then(connections => connections.reduce((acc, curr) => curr, null));
      });

    // Generate connection links
    const outlineLink = this.outlineService.getOutlineDynamicLink(connection);
    const fastRedirectLink = this.outlineService.getConnectionRedirectLink(connection);

    const scene = SCENES.CONNECT.balancePositive(outlineLink);

    // Add redirect buttons for iOS and Android
    scene.buttons = [
      [Markup.button.url('для iOS 🍏', fastRedirectLink)],
      [Markup.button.url('для Android 🤖', fastRedirectLink)],
    ];

    this.sceneReply(ctx, scene);
  }
}
```

**Configuration**: [src/constants/scenes.const.ts:69-82](src/constants/scenes.const.ts#L69-L82)

```typescript
[CommandEnum.CONNECT]: {
  balancePositive: (connectionLink: string) => ({
    text: `Подключение к Outline:

    Ваша ссылка:
    └ <code>${connectionLink}</code>
    Нажмите чтобы скопировать (тапните) и добавьте в приложение

    Если приложение уже установлено - воспользуйтесь быстрым подключением
    - Outline - для iOS 🍏
    - Outline - для Android 🤖`,
    buttons: []
  })
}
```

**Flow**:
1. Check if user has sufficient balance
2. If insufficient → redirect to `GET_ACCESS` scene
3. Create new VPN connection via Outline API (or fetch existing)
4. Generate `ssconf://` link for manual copy
5. Generate redirect links for quick connection
6. Display links and buttons

**Entry Points**:
- User clicks "⚡ Подключиться" from HOME

**Exit Points**:
- User clicks redirect links (external, opens Outline app)
- If insufficient balance → `GET_ACCESS` scene

**Connection Creation**:
- Calls `OutlineService.createConnection()` which:
  1. Checks connection limit
  2. Calls Outline Management API
  3. Parses Shadowsocks URL
  4. Saves to database

---

### 7. STATUS Scene

**File**: [src/scenes/status.scene.ts](src/scenes/status.scene.ts)

**Decorator**: `@Scene(CommandEnum.STATUS)`

```typescript
@Scene(CommandEnum.STATUS)
export class StatusScene extends AbstractScene {
  constructor(
    private userService: UserService,
    private connService: ConnectionService
  ) {
    super();
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    this.logger.log(ctx.scene.session.current);

    // Get user data
    const user = await this.userService.user({ userId: ctx.from.id });
    const balance = user.balance.toLocaleString('ru-RU', {
      style: 'currency',
      currency: 'RUB',
    });

    // Get connection count
    const connCount = await this.connService.count();

    const scene = SCENES[CommandEnum.STATUS];

    // Display user info
    await ctx.replyWithHTML(
      scene.text(user.username, balance, connCount),
      Markup.inlineKeyboard(scene.buttons)
    );
  }
}
```

**Configuration**: [src/constants/scenes.const.ts:83-86](src/constants/scenes.const.ts#L83-L86)

```typescript
[CommandEnum.STATUS]: {
  text: (username: string, balance: string, connectionsNumber: number) =>
    `Ваш никнейм: @${username}\nВаш баланс: ${balance}\n\nЧисло подключений: ${connectionsNumber}`,
  buttons: [BUTTONS[CommandEnum.HOME]],
}
```

**Flow**:
1. Fetch user data from database
2. Format balance
3. Count total connections
4. Display username, balance, and connection count
5. Show "Home" button

**Entry Points**:
- User clicks "ℹ️ Статус" from HOME

**Exit Points**:
- User clicks "📱в меню" → `HOME` scene

---

### 8. QUESTION Scene

**File**: [src/scenes/question.scene.ts](src/scenes/question.scene.ts)

**Decorator**: `@Scene(CommandEnum.QUESTION)`

```typescript
@Scene(CommandEnum.QUESTION)
export class QuestionScene extends AbstractScene {}
```

**Implementation**: Uses default `AbstractScene` behavior

**Configuration**: [src/constants/scenes.const.ts:87-92](src/constants/scenes.const.ts#L87-L92)

```typescript
[CommandEnum.QUESTION]: {
  text: `Если у тебя есть вопрос, то ты можешь, посмотреть в документацию или задать его в нашем чате.`,
  buttons: [
    [BUTTONS[CommandEnum.JOIN_CHAT]],
  ]
}
```

**Flow**:
1. Display help message
2. Show button to join support chat

**Entry Points**:
- User clicks "❓ Помощь" from HOME

**Exit Points**:
- User clicks "Открыть чат" (external link to Telegram chat)

---

## Button Definitions

**File**: [src/constants/buttons.const.ts](src/constants/buttons.const.ts)

### Button Types

Telegraf provides multiple button types:

1. **Inline Buttons** - `Markup.button.callback(text, callbackData)`
   - Appear below messages
   - Send callback query when clicked
   - Handled by `@Action()` decorators

2. **Keyboard Buttons** - `Markup.button.callback(text, callbackData)` (rendered with `Markup.keyboard()`)
   - Persistent buttons below chat input
   - Send text message when clicked
   - Handled by `@Hears()` decorators

3. **URL Buttons** - `Markup.button.url(text, url)`
   - Open external links
   - Not handled by bot

### Button Definitions

```typescript
export const BUTTONS = {
  // Navigation
  [CommandEnum.BACK]: Markup.button.callback('⬅ назад', CommandEnum.BACK),
  [CommandEnum.HOME]: Markup.button.callback('📱в меню', CommandEnum.HOME),

  // Main menu
  [CommandEnum.STATUS]: Markup.button.callback('ℹ️ Статус', CommandEnum.STATUS),
  [CommandEnum.CONNECT]: Markup.button.callback('⚡ Подключиться', CommandEnum.CONNECT),
  [CommandEnum.GET_ACCESS]: Markup.button.callback('🔥 Купить', CommandEnum.GET_ACCESS),
  [CommandEnum.QUESTION]: Markup.button.callback('❓ Помощь', CommandEnum.QUESTION),

  // Tariff selection
  [CommandEnum.MONTH_TARIFF]: Markup.button.callback('30 дней', CommandEnum.MONTH_TARIFF),
  [CommandEnum.THREEMONTH_TARIFF]: Markup.button.callback('🔥 3 месяца', CommandEnum.THREEMONTH_TARIFF),
  [CommandEnum.SIXMONTH_TARIFF]: Markup.button.callback('🚀 6 месяцев', CommandEnum.SIXMONTH_TARIFF),

  // External links
  [CommandEnum.OUTLINE_APPLE]: Markup.button.url('🍏 для iPhone', 'https://apps.apple.com/us/app/outline-app/id1356177741'),
  [CommandEnum.OUTLINE_ANDROID]: Markup.button.url('🤖 для Android', 'https://play.google.com/store/apps/details?id=org.outline.android.client'),
  [CommandEnum.JOIN_CHAT]: Markup.button.url('Открыть чат', 'https://t.me/openpnbot'),

  // Payment
  [CommandEnum.PAY_WITH_YOOMONEY]: Markup.button.callback('💳 картой РФ', CommandEnum.PAY_WITH_YOOMONEY),
  [CommandEnum.CONFIRM_PAYMENT]: Markup.button.callback('✅ Я оплатил', CommandEnum.CONFIRM_PAYMENT),
};
```

### Button Usage Pattern

**In Scene Configuration**:
```typescript
// Single row of buttons
buttons: [
  [BUTTONS[CommandEnum.HOME]]
]

// Multiple rows
buttons: [
  [BUTTONS[CommandEnum.STATUS], BUTTONS[CommandEnum.CONNECT]],
  [BUTTONS[CommandEnum.GET_ACCESS], BUTTONS[CommandEnum.QUESTION]]
]

// Dynamic buttons from data
buttons: (tariffs: Tariff[]) =>
  splitArrayIntoPairs(tariffs.map((tariff) => BUTTONS[CommandEnum[tariff.name + '_TARIFF']]))
```

---

## Scene Navigation Flow

### Navigation Graph

```
START (onboarding)
  ↓
HOME (main menu)
  ├─→ STATUS (view account info)
  │     └─→ HOME
  │
  ├─→ CONNECT (get VPN connection)
  │     ├─→ (if insufficient balance) GET_ACCESS
  │     └─→ (connection created) → external app
  │
  ├─→ GET_ACCESS (view tariffs)
  │     ├─→ MONTH_TARIFF → PAYMENT
  │     ├─→ THREEMONTH_TARIFF → PAYMENT
  │     ├─→ SIXMONTH_TARIFF → PAYMENT
  │     └─→ HOME
  │
  └─→ QUESTION (help/support)
        └─→ external chat link

PAYMENT (payment flow)
  ├─→ PAY_WITH_YOOMONEY → external payment
  └─→ CONFIRM_PAYMENT (future feature)
```

### Navigation Methods

**1. Explicit Navigation**
```typescript
await ctx.scene.enter(CommandEnum.HOME);
```

**2. Button Callback Navigation** (via `@Action(/.*/)` handler)
```typescript
// Button click automatically navigates to scene matching callback data
[BUTTONS[CommandEnum.STATUS]] // Callback data = "STATUS" → enters STATUS scene
```

**3. Text Message Navigation** (via `@Hears(/.*/)` handler)
```typescript
// Keyboard button text matched to button definition, then navigates to scene
```

---

## Context Interface

**File**: [src/interfaces/context.interface.ts](src/interfaces/context.interface.ts)

```typescript
export interface Context extends BaseContext {
  update: Update.CallbackQueryUpdate;
  session: SessionData;
  scene: Scenes.SceneContextScene<Context, SceneSession>;
  match: any;
}

interface SessionData {
  messageId: number;      // For message editing
  tariffId: string;       // Selected tariff ID (set in tariff scenes)
}
```

### Session Usage

**Setting Session Data**:
```typescript
ctx.session.tariffId = tariff.id.toString();
```

**Reading Session Data**:
```typescript
const { tariffId } = ctx.session;
```

**Session Lifetime**:
- Persists across scenes during single conversation
- Cleared on bot restart (in-memory storage)

---

## Middlewares

### 1. Session Middleware

**Configuration**: [src/bot.module.ts](src/bot.module.ts)

```typescript
middlewares: [session()]
```

**Purpose**:
- Enables `ctx.session` for storing conversation state
- Required for scene navigation
- Stores `messageId` and `tariffId`

---

### 2. Command Args Middleware

**File**: [src/middlewares/command-args.middleware.ts](src/middlewares/command-args.middleware.ts)

**Configuration**: [src/bot.module.ts](src/bot.module.ts)

```typescript
middlewares: [commandArgs()]
```

**Purpose**:
- Parses command arguments into `ctx.state.command.args`
- Example: `/tariff MONTH_TARIFF 299` → `args = ["MONTH_TARIFF", "299"]`

**Usage**:
```typescript
@Command('tariff')
async changeTariff(@Ctx() ctx: Context) {
  const [tariffName, price] = ctx.state.command.args;
  // ...
}
```

---

## Best Practices & Patterns

### 1. Scene Configuration Pattern

**Separation of Concerns**:
- Scene logic in `*.scene.ts` files
- Scene content/UI in `constants/scenes.const.ts`
- Button definitions in `constants/buttons.const.ts`

**Benefits**:
- Easy to update UI text without touching logic
- Centralized button management
- Reusable button definitions

---

### 2. Dynamic Content Pattern

**Function-based Scene Content**:
```typescript
text: (balance: string, tariff: string) => `Balance: ${balance}\nTariff: ${tariff}`
```

**Benefits**:
- Scene content adapts to user data
- Type-safe parameters
- Easy to test

---

### 3. Service Injection Pattern

**Scenes as Services**:
```typescript
@Scene(CommandEnum.PAYMENT)
export class PaymentScene extends AbstractScene {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly tariffService: TariffService
  ) {
    super();
  }
}
```

**Benefits**:
- Access to business logic services
- Testable with dependency injection
- Follows NestJS patterns

---

### 4. Error Handling

**Global Exception Filter**:
```typescript
@UseFilters(AllExceptionFilter)
@Update()
export class BotUpdate {
  // ...
}
```

**Try-Catch in Handlers**:
```typescript
try {
  // Bot logic
} catch (e) {
  this.logger.log(e);
  await ctx.reply('Произошла ошибка');
}
```

---

### 5. Private Chat Enforcement

**Pattern**:
```typescript
if (!['private'].includes(message.chat.type)) {
  await ctx.reply('Для работы с ботом, нужно писать ему в личные сообщения');
  return;
}
```

**Purpose**: Ensure bot only works in private chats (not groups)

---

### 6. Payment Link Expiry Pattern

**Auto-expiring Buttons**:
```typescript
setTimeout(async () => {
  await ctx.telegram.editMessageText(
    chatId,
    messageId,
    undefined,
    `Ссылка на оплату истекла`,
    { parse_mode: 'HTML' }
  );
}, 600000); // 10 minutes
```

**Purpose**: Security - prevent old payment links from being reused

---

### 7. Graceful Degradation

**Connection Creation Fallback**:
```typescript
const connection = await this.outlineService.createConnection(userId, "OpenPNBot")
  .catch(reason => {
    // If creation fails, return last connection
    return this.connService.connections({ where: { userId: userId }})
      .then(connections => connections.reduce((acc, curr) => curr, null));
  });
```

**Purpose**: If VPN connection creation fails, show existing connection instead of error

---

## Telegraf Decorators Reference

### Class-Level Decorators

| Decorator | Purpose | File |
|-----------|---------|------|
| `@Update()` | Marks class as main bot handler | [bot.update.ts:18](src/bot.update.ts#L18) |
| `@Scene(name)` | Defines a conversation scene | All `*.scene.ts` files |

---

### Method-Level Decorators

| Decorator | Trigger | Example Usage |
|-----------|---------|---------------|
| `@Start()` | `/start` command | [bot.update.ts:34](src/bot.update.ts#L34) |
| `@Command('name')` | `/name` command | [bot.update.ts:85](src/bot.update.ts#L85) `/tariff` |
| `@Action(pattern)` | Inline button click | [bot.update.ts:53](src/bot.update.ts#L53), [payment.scene.ts:40](src/scenes/payment.scene.ts#L40) |
| `@Hears(pattern)` | Text message matching pattern | [bot.update.ts:66](src/bot.update.ts#L66), [bot.update.ts:123](src/bot.update.ts#L123) |
| `@SceneEnter()` | Entering a scene | [abstract.scene.ts:26](src/abstract/abstract.scene.ts#L26) |
| `@SceneLeave()` | Leaving a scene | [abstract.scene.ts:35](src/abstract/abstract.scene.ts#L35) |

---

### Parameter Decorators

| Decorator | Purpose | Type |
|-----------|---------|------|
| `@Ctx()` | Inject context object | `Context` |
| `@InjectBot(name)` | Inject bot instance | `Telegraf<Context>` |

---

## Markup Methods Reference

### Button Types

```typescript
// Inline callback button
Markup.button.callback(text: string, callbackData: string)

// URL button (external link)
Markup.button.url(text: string, url: string)

// Contact request button
Markup.button.contactRequest(text: string)

// Location request button
Markup.button.locationRequest(text: string)
```

---

### Button Layouts

```typescript
// Inline keyboard (below message)
Markup.inlineKeyboard([
  [button1, button2],      // Row 1: 2 buttons
  [button3]                // Row 2: 1 button
])

// Reply keyboard (persistent, below input)
Markup.keyboard([
  [button1, button2],
  [button3, button4]
]).resize()                // Auto-resize keyboard

// Remove keyboard
{ reply_markup: { remove_keyboard: true }}
```

---

## Scene Session Storage

**Current Scene**: `ctx.scene.session.current` (string)

**Navigation**:
```typescript
await ctx.scene.enter(sceneName);  // Enter scene
await ctx.scene.leave();           // Leave current scene
await ctx.scene.reenter();         // Reenter current scene
```

---

## Summary

The bot uses a **scene-based architecture** with Telegraf's scene management:

1. **BotUpdate** handles global commands and routes button clicks to scenes
2. **AbstractScene** provides base functionality for all scenes
3. **Scene classes** implement specific conversation flows
4. **SCENES constant** defines UI content and buttons
5. **Session** stores conversation state (`tariffId`, `messageId`)
6. **Middlewares** enable session storage and command argument parsing

**Key Patterns**:
- Decorator-based routing (`@Command`, `@Action`, `@Hears`)
- Dependency injection (services in scene constructors)
- Configuration separation (logic vs. content)
- Dynamic content generation (functions in SCENES)
- Error handling (global filter + try-catch)

**Navigation Flow**:
- Command → `@Command` handler → `ctx.scene.enter()`
- Button click → `@Action` handler → `ctx.scene.enter()`
- Scene enter → `@SceneEnter()` → render content
- User selects option → navigate to next scene

This architecture makes it easy to add new features by creating new scenes without modifying existing code.
