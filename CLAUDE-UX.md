# CLAUDE-UX.md

This file documents the complete user experience flow, scene routing, and bot interaction patterns for the VPN Telegram Bot.

## Bot Architecture Overview

The bot uses a **scene-based conversation flow** powered by `nestjs-telegraf`. Each scene represents a distinct user interface state with specific buttons, text, and navigation options.

### Scene System Components

1. **AbstractScene** ([src/abstract/abstract.scene.ts](src/abstract/abstract.scene.ts)): Base class for all scenes
   - `@SceneEnter()` decorator: Called when entering a scene
   - `@SceneLeave()` decorator: Called when leaving a scene
   - `sceneReply()` method: Handles message rendering with keyboard/buttons

2. **SCENES constant** ([src/constants/scenes.const.ts](src/constants/scenes.const.ts)): Defines all UI text and button layouts

3. **BUTTONS constant** ([src/constants/buttons.const.ts](src/constants/buttons.const.ts)): Defines all button configurations

4. **CommandEnum** ([src/enum/command.enum.ts](src/enum/command.enum.ts)): Scene identifiers used for routing

## Complete User Journey Map

### 1. First-Time User Flow

```
/start (any chat type)
    ↓
[BotUpdate.onStart()] checks chat type
    ↓
├─ Group/Channel → "Для работы с ботом, нужно писать ему в личные сообщения" → EXIT
└─ Private chat → upsertUser() → START Scene
    ↓
START Scene
├─ Text: Instructions to download Outline app
├─ Buttons: [🍏 для iPhone] [🤖 для Android]
└─ Navigate keyboard: [ℹ️ Статус] [⚡ Подключиться]
                       [🔥 Купить] [❓ Помощь]
    ↓
User clicks any navigate button → Routes to corresponding scene
```

### 2. Main Navigation Hub (HOME Scene)

**Entry Points:**
- Clicking "📱в меню" button from any scene
- Hearing the HOME button text via `@Hears` decorator
- Returning from other scenes

**Scene:** [src/scenes/home.scene.ts](src/scenes/home.scene.ts)
- Extends AbstractScene with default behavior
- Displays SCENES.HOME configuration

**UI:**
```
Text: "👋🏻 Привет! Это Telegram-бот для подключения к VPN.
       Доступны локации: ├ 🇳🇱 Нидерланды"

Keyboard buttons (persistent):
[ℹ️ Статус] [⚡ Подключиться]
[🔥 Купить] [❓ Помощь]
```

**Navigation from HOME:**
- `ℹ️ Статус` → STATUS Scene
- `⚡ Подключиться` → CONNECT Scene
- `🔥 Купить` → GET_ACCESS Scene
- `❓ Помощь` → QUESTION Scene

### 3. Status Information (STATUS Scene)

**Scene:** [src/scenes/status.scene.ts](src/scenes/status.scene.ts)

**Flow:**
```
STATUS Scene Entry
    ↓
Query database for user info
    ↓
Display:
├─ Username: @{username}
├─ Balance: {balance} (formatted as RUB)
└─ Connections count: {connectionsNumber}
    ↓
Inline button: [📱в меню]
```

### 4. VPN Connection Flow (CONNECT Scene)

**Scene:** [src/scenes/connect.scene.ts](src/scenes/connect.scene.ts)

**Critical Logic:**
```
CONNECT Scene Entry
    ↓
Check user.balance <= MINIMUM_BALANCE (from config)
    ↓
├─ Insufficient balance → Redirect to GET_ACCESS Scene
└─ Sufficient balance
    ↓
    Attempt OutlineService.createConnection(userId, "OpenPNBot")
    ↓
    ├─ Success → New VPN key created
    └─ Failure/Limit exceeded → Fetch last existing connection
    ↓
    Generate links:
    ├─ outlineLink: ssconf://{domain}/conf/v1/{hashId}/{name}
    └─ fastRedirectLink: https://{domain}/redirect/v1/{hashId}/{name}
    ↓
    Display connection information:
    ├─ Text: Connection link (tappable to copy)
    └─ Buttons: [для iOS 🍏] [для Android 🤖] (URL buttons to redirect link)
```

**Key Variables:**
- `MINIMUM_BALANCE = 3.0` (hardcoded in ConnectScene)
- Connection limit enforced by `OutlineService.createConnection()` → checks `user.connLimit`

### 5. Purchase Flow (GET_ACCESS → Tariff Selection → PAYMENT)

#### 5.1 GET_ACCESS Scene

**Scene:** [src/scenes/get-access.scene.ts](src/scenes/get-access.scene.ts)

**Flow:**
```
GET_ACCESS Scene Entry
    ↓
Fetch all tariffs from database
    ↓
Display:
├─ Navigate text: "Для получения доступа к VPN..."
├─ Navigate keyboard: [📱в меню]
├─ Current balance: {balance formatted as RUB}
└─ Tariff options with inline buttons
```

**UI Example:**
```
Периоды пополнения:
30 дней: 30 дней. 299руб.
🔥 3 месяца: 90 дней. 799руб.
🚀 6 месяцев: 180 дней. 1499руб.

Текущий баланс: 0,00 ₽

Inline buttons:
[30 дней] [🔥 3 месяца]
[🚀 6 месяцев]
```

#### 5.2 Tariff Selection (Intermediate Scenes)

**Scenes:**
- [src/scenes/month-tariff.scene.ts](src/scenes/month-tariff.scene.ts)
- [src/scenes/threemonth-tariff.scene.ts](src/scenes/threemonth-tariff.scene.ts)
- [src/scenes/sixmonth-tariff.scene.ts](src/scenes/sixmonth-tariff.scene.ts)

**Flow (all identical):**
```
User clicks tariff button (e.g., "🔥 3 месяца")
    ↓
Enters THREEMONTH_TARIFF Scene
    ↓
@SceneEnter():
├─ Parse scene name: ctx.scene.session.current.split('_')[0] → "THREEMONTH"
├─ Fetch tariff from DB: TariffService.getOneByName("THREEMONTH")
├─ Store in session: ctx.session.tariffId = tariff.id
└─ Immediately redirect: ctx.scene.enter(CommandEnum.PAYMENT)
```

**Note:** These scenes are **pass-through** - user never sees them, they just set session state.

#### 5.3 PAYMENT Scene

**Scene:** [src/scenes/payment.scene.ts](src/scenes/payment.scene.ts)

**Flow:**
```
PAYMENT Scene Entry (from tariff scene)
    ↓
Retrieve from session: ctx.session.tariffId
    ↓
Display:
├─ Current balance: {balance}
├─ Selected tariff: {tariff.name}
└─ Payment method selection

Inline buttons:
[💳 картой РФ]      ← PAY_WITH_YOOMONEY action
[✅ Я оплатил]      ← CONFIRM_PAYMENT action (currently no-op)
```

**Payment Action Flow:**
```
User clicks "💳 картой РФ"
    ↓
@Action(CommandEnum.PAY_WITH_YOOMONEY)
    ↓
PaymentService.createPayment(
    userId: ctx.from.id,
    chatId: ctx.chat.id,
    tariffId: ctx.session.tariffId,
    paymentSystem: PaymentSystemEnum.YOOMONEY
)
    ↓
Payment record created in database (status: PENDING)
    ↓
Send new message:
├─ Text: "Чтобы оплатить подписку... нажав на кнопку ниже"
└─ Button: [👉 перейти к оплате] → payment.url (external YooMoney page)
    ↓
Set timeout (10 minutes):
    After 600000ms → Edit message: "Ссылка на оплату истекла..."
```

### 6. Payment Processing (Background)

#### 6.1 Payment Validation (Webhook)

**Endpoint:** `POST /payment/yoomoney/notification`
**Controller:** [src/payment/payment.controller.ts](src/payment/payment.controller.ts)

**Flow:**
```
YooMoney sends webhook notification
    ↓
PaymentService.yooMoneyWebHook():
├─ Verify SHA1 hash signature
├─ Validate operation details via YooMoney API
└─ If valid: Update payment status to PAID
    ↓
PaymentService.validatePayment():
├─ Check payment status
└─ If PAID and status changed:
    ├─ UserService.commitBalanceChange(user, tariff.price, PAYMENT, paymentId)
    └─ Update payment.status = PAID, isFinal = true
```

#### 6.2 Payment Polling (Cron Job)

**Scheduler:** [src/payment/payment.scheduler.ts](src/payment/payment.scheduler.ts)

**Cron:** `@Cron(CronExpression.EVERY_10_SECONDS)`

**Flow:**
```
Every 10 seconds:
    ↓
Fetch all payments with status = PENDING
    ↓
For each pending payment:
    ├─ PaymentService.validatePayment(paymentId)
    ├─ Query payment gateway for status
    └─ If status changed to PAID:
        ├─ Commit balance change to user
        ├─ Send success message to user's chatId
        └─ Send notification to admin(s) via BotService.sendPaymentSuccessMessageToAdmin()
```

**Admin Notification Format:**
```
"Пользователь {username} оплатил, его баланс {balance}.
Оплаченная сумма: {amount}. Платежная система {paymentSystem} 🎉"
```

Sent to:
- `ADMIN_CHAT_ID` (primary admin)
- `ADMIN_CHAT_ID_2` (secondary admin)

### 7. Daily Balance Deduction (Subscription Fee)

**Scheduler:** [src/payment/payment.scheduler.ts](src/payment/payment.scheduler.ts)

**Cron:** `@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)`

**Flow:**
```
Every day at 00:00:
    ↓
Get serviceFee from config: botService.minimumBalance
    ↓
Fetch all users with balance >= serviceFee
    ↓
For each user:
    ├─ UserService.commitBalanceChange(user, -serviceFee, SCHEDULER)
    └─ If balance becomes insufficient (< 0):
        └─ Send message: "Требуется пополнить баланс для списания {change}
                         Текущий баланс: {balance}"
```

**Important:** Balance changes are only committed if the result is `>= 0` (status: DONE), otherwise status is INSUFFICIENT and balance stays unchanged.

### 8. Help & Support (QUESTION Scene)

**Scene:** [src/scenes/question.scene.ts](src/scenes/question.scene.ts)

**UI:**
```
Text: "Если у тебя есть вопрос, то ты можешь, посмотреть в
       документацию или задать его в нашем чате."

Button: [Открыть чат] → URL: https://t.me/openpnbot
```

## Routing Mechanisms

### 1. Command Routing (BotUpdate)

**File:** [src/bot.update.ts](src/bot.update.ts)

#### @Start() Decorator
```typescript
/start command
    ↓
Check message.chat.type === 'private'
├─ No → Reply error, EXIT
└─ Yes → upsertUser() → ctx.scene.enter(CommandEnum.START)
```

#### @Action(/.*/) Decorator (Catch-all for inline buttons)
```typescript
User clicks ANY inline button
    ↓
Extract callback_query.data (contains CommandEnum value)
    ↓
ctx.scene.enter(callbackData)
    → Routes to scene matching the button's callback data
```

#### @Hears() Decorators

**Specific Hears:**
```typescript
@Hears(BUTTONS[CommandEnum.HOME].text) // "📱в меню"
    ↓
Check user exists in DB
├─ Yes → ctx.scene.enter(CommandEnum.HOME)
└─ No → ctx.scene.enter(CommandEnum.START)
```

**Catch-all Hears:**
```typescript
@Hears(/.*/) // Matches any text message
    ↓
Update user.chatId if not set
    ↓
Find button matching message text in BUTTONS constant
    ↓
ctx.scene.enter(matchingCommand)
```

#### Admin Commands

**@Command('tariff')**
```typescript
/tariff <tariffName> <price>
    ↓
Check isAdmin(ctx) → ctx.chat.id === ADMIN_CHAT_ID
    ↓
If admin: TariffService.updateTariffPrice(tariffName, price)
```

**@Command('up')**
```typescript
/up <username> <changeAmount>
    ↓
Check isAdmin(ctx)
    ↓
If admin:
├─ Find user by username
├─ UserService.commitBalanceChange(user, changeAmount, MANUALLY)
└─ Send confirmation to admin chatId
```

### 2. Session State Management

**Telegraf Session Middleware** configured in BotModule:
```typescript
middlewares: [session(), commandArgs()]
```

**Session Variables:**
- `ctx.session.messageId` - For message editing/tracking
- `ctx.session.tariffId` - Selected tariff during purchase flow
- `ctx.scene.session.current` - Current scene name

### 3. Scene Navigation Patterns

**Pattern 1: Direct Navigation**
```typescript
ctx.scene.enter(CommandEnum.SCENE_NAME)
```

**Pattern 2: Conditional Redirect**
```typescript
// In ConnectScene
if (user.balance <= minimumBalance) {
    ctx.scene.enter(CommandEnum.GET_ACCESS)
    return
}
```

**Pattern 3: Pass-through Scene**
```typescript
// In tariff scenes
@SceneEnter()
async onSceneEnter(ctx: Context) {
    ctx.session.tariffId = tariff.id
    ctx.scene.enter(CommandEnum.PAYMENT) // Immediate redirect
}
```

## Button Types & Behavior

### 1. Keyboard Buttons (Persistent, Bottom of Screen)

**Usage:** Navigate buttons that stay visible
**Rendering:** `Markup.keyboard(buttons).resize()`

**Examples:**
```typescript
[ℹ️ Статус] [⚡ Подключиться]
[🔥 Купить] [❓ Помощь]
[📱в меню] // Home button
```

**Trigger:** `@Hears()` decorator in BotUpdate

### 2. Inline Buttons (Inline with Message)

**Usage:** Action buttons attached to specific messages
**Rendering:** `Markup.inlineKeyboard(buttons)`

**Types:**

**Callback buttons:**
```typescript
Markup.button.callback('Text', CommandEnum.CALLBACK_DATA)
// Example: [💳 картой РФ] triggers @Action(PAY_WITH_YOOMONEY)
```

**URL buttons:**
```typescript
Markup.button.url('Text', 'https://...')
// Example: [для iOS 🍏] opens connection redirect link
```

**Trigger:** `@Action()` decorator in scene classes

## Error Handling & Edge Cases

### 1. Insufficient Balance Flow

**Scenario:** User tries to connect without sufficient balance

```
CONNECT Scene → balance check fails
    ↓
Redirect to GET_ACCESS Scene (no error message shown)
```

### 2. Connection Limit Exceeded

**Scenario:** User already has maximum connections

```
OutlineService.createConnection() → throws error
    ↓
.catch() → Fetch last existing connection instead
    ↓
Display existing connection info (no new key created)
```

### 3. Payment Link Expiry

```
User clicks PAY_WITH_YOOMONEY → Message sent with payment URL
    ↓
setTimeout(600000ms) // 10 minutes
    ↓
Edit message: "Ссылка на оплату истекла. Пожалуйста, попробуйте снова..."
```

### 4. Non-Private Chat Handling

```
User sends /start in group/channel
    ↓
Reply: "Для работы с ботом, нужно писать ему в личные сообщения"
    ↓
remove_keyboard: true
    ↓
EXIT (no scene entered)
```

## Message Rendering Utilities

### replyOrEdit() Function
([src/utils/reply-or-edit.ts](src/utils/reply-or-edit.ts))

Attempts to edit existing message, falls back to new reply if editing fails.

### sceneReply() Method
(AbstractScene base class)

**Logic:**
```typescript
if (navigateButtons && navigateText) {
    // Send persistent keyboard with navigate text
    ctx.replyWithHTML(navigateText, Markup.keyboard(navigateButtons).resize())
}
if (buttons && text) {
    // Send inline buttons with scene text
    ctx.replyWithHTML(text, Markup.inlineKeyboard(buttons))
}
if (!navigateButtons && !buttons && text) {
    // Plain text only
    ctx.replyWithHTML(text)
}
```

## Complete Scene Routing Table

| Scene | Trigger | Entry Logic | Exit Routes |
|-------|---------|-------------|-------------|
| START | `/start` command | upsertUser(), show Outline download links | Navigate buttons → HOME/STATUS/CONNECT/GET_ACCESS/QUESTION |
| HOME | "📱в меню" button | Default AbstractScene | Navigate buttons → STATUS/CONNECT/GET_ACCESS/QUESTION |
| STATUS | "ℹ️ Статус" button | Query user info, show stats | [📱в меню] → HOME |
| CONNECT | "⚡ Подключиться" button | Balance check → create/fetch connection | Auto-redirect to GET_ACCESS if insufficient balance |
| GET_ACCESS | "🔥 Купить" button | Fetch tariffs, show pricing | Inline buttons → MONTH_TARIFF/THREEMONTH_TARIFF/SIXMONTH_TARIFF |
| MONTH_TARIFF | Tariff inline button | Store tariffId in session | Auto-redirect → PAYMENT |
| THREEMONTH_TARIFF | Tariff inline button | Store tariffId in session | Auto-redirect → PAYMENT |
| SIXMONTH_TARIFF | Tariff inline button | Store tariffId in session | Auto-redirect → PAYMENT |
| PAYMENT | From tariff scene | Show payment options | [💳 картой РФ] → Creates payment, sends external URL |
| QUESTION | "❓ Помощь" button | Show help text | [Открыть чат] → External Telegram link |

## Key UX Patterns & Design Decisions

1. **Pass-through Scenes:** Tariff selection scenes don't render UI, they just set session state and redirect. This keeps the flow simple.

2. **Graceful Degradation:** When connection creation fails (limit exceeded), bot shows last connection instead of error.

3. **Balance-First Approach:** CONNECT scene redirects to payment if balance is low, preventing frustration.

4. **Dual Payment Validation:** Both webhooks (instant) and polling (every 10s) ensure payments are caught even if webhook fails.

5. **Admin Transparency:** All successful payments notify two admins with user details.

6. **Session Persistence:** User state (selected tariff) stored in Telegraf session, survives between messages.

7. **Link Expiry:** Payment URLs auto-expire after 10 minutes to prevent stale links.

8. **Daily Billing:** Automatic balance deduction at midnight ensures subscription continuity.

9. **Audit Trail:** All balance changes logged in BalanceChange table with type (PAYMENT/MANUALLY/SCHEDULER).

10. **No Scene Leaks:** All scenes either have explicit navigation or auto-redirect (tariff scenes), preventing users from getting stuck.
