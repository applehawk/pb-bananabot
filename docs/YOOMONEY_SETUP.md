# Настройка YooMoney для покупки кредитов

## Обзор

Интеграция YooMoney позволяет пользователям покупать кредиты для генерации изображений через российскую платежную систему ЮMoney.

## Архитектура

```
Пользователь → Telegram Bot → buy_credits conversation
                              ↓
                     PaymentService.createPayment()
                              ↓
                     YooMoneyPaymentStrategy
                              ↓
                     Генерация формы оплаты
                              ↓
              Пользователь переходит по ссылке оплаты
                              ↓
              YooMoney отправляет webhook уведомление
                              ↓
           PaymentController.yooMoneyWebHook()
                              ↓
           PaymentService.validatePayment()
                              ↓
           CreditsService.addCredits()
```

## Настройка

### 1. Получение учетных данных YooMoney

1. Зарегистрируйтесь на https://yoomoney.ru
2. Создайте приложение OAuth: https://yoomoney.ru/settings/oauth-services
3. Получите следующие данные:
   - **YOOMONEY_TOKEN** - OAuth токен вашего приложения
   - **YOOMONEY_SHOP_ID** - ID вашего магазина (если используется)
   - **YOOMONEY_SECRET** - Секретный ключ для проверки webhook уведомлений
   - **YOOMONEY_WALLET** - Номер кошелька получателя

### 2. Настройка HTTP уведомлений

1. Перейдите на https://yoomoney.ru/transfer/myservices/http-notification
2. Включите HTTP уведомления
3. Укажите URL webhook: `https://yourdomain.com/payment/yoomoney/notification`
4. Укажите секретное слово (это и будет `YOOMONEY_SECRET`)

### 3. Переменные окружения

Добавьте в ваш `.env` файл:

```env
# YooMoney Configuration
YOOMONEY_TOKEN=your_yoomoney_oauth_token
YOOMONEY_SHOP_ID=your_shop_id
YOOMONEY_SECRET=your_secret_word_from_http_notifications
YOOMONEY_WALLET=your_wallet_number
YOOMONEY_SUCCESS_URL=https://t.me/your_bot_username
```

### 4. Создание пакетов кредитов

Запустите seed скрипт для создания пакетов:

```bash
npm run seed:packages
# или
npx tsx web/scripts/seed-packages.ts
```

Это создаст 3 пакета:
- **Starter** - 10 кредитов за 99₽
- **Pro** - 50 кредитов за 399₽ (скидка 20%)
- **Ultimate** - 150 кредитов за 999₽ (скидка 30%)

## Использование

### Flow покупки кредитов

1. Пользователь отправляет команду `/buy_credits` или выбирает "💎 Купить кредиты" в меню
2. Бот показывает доступные пакеты кредитов
3. Пользователь выбирает пакет
4. Бот показывает доступные способы оплаты (YooMoney, Stars, Crypto)
5. Пользователь выбирает YooMoney
6. Создается транзакция в БД со статусом `PENDING`
7. Бот отправляет ссылку на оплату через YooMoney
8. Пользователь оплачивает
9. YooMoney отправляет webhook уведомление
10. Система проверяет подпись и валидирует платеж
11. Кредиты зачисляются на баланс пользователя
12. Транзакция обновляется до статуса `COMPLETED`

### Проверка статуса платежа

Пользователь может нажать кнопку "✅ Я оплатил", чтобы проверить статус платежа вручную.

## Endpoints

### POST /payment/yoomoney/notification
Webhook endpoint для получения уведомлений от YooMoney.

**Тело запроса (YooMoneyNotification):**
```json
{
  "notification_type": "p2p-incoming",
  "operation_id": "operation_id_here",
  "amount": "99.00",
  "currency": "643",
  "datetime": "2025-01-18T12:00:00Z",
  "sender": "sender_wallet",
  "codepro": "false",
  "label": "payment_id_here",
  "sha1_hash": "hash_here"
}
```

**Проверка подписи:**
```
SHA1(notification_type&operation_id&amount&currency&datetime&sender&codepro&secret&label)
```

### GET /payment/yoomoney/success
Redirect endpoint после успешной оплаты. Перенаправляет пользователя обратно в Telegram.

### GET /payment/:paymentId
Возвращает HTML форму оплаты YooMoney.

## Код

### Основные файлы

- `src/conversations/buy-credits.conversation.ts` - Conversation для покупки кредитов
- `src/payment/payment.service.ts` - Сервис для работы с платежами
- `src/payment/payment.controller.ts` - Controller для webhook endpoints
- `src/payment/strategies/yoomoney-payment.strategy.ts` - Strategy для YooMoney платежей
- `src/credits/credits.service.ts` - Сервис для работы с кредитами

### Database Schema

**Transaction model:**
```prisma
model Transaction {
  id            String            @id @default(cuid())
  userId        String
  type          TransactionType   // PURCHASE, USAGE, BONUS, REFUND
  amount        Float            // Сумма в рублях
  creditsAdded  Float            // Кредиты добавленные/списанные
  paymentMethod PaymentMethod    // YOOMONEY, TELEGRAM_STARS, CRYPTO
  paymentId     String?          // Внешний ID платежа
  status        TransactionStatus // PENDING, COMPLETED, FAILED, CANCELLED
  isFinal       Boolean          @default(false)
  packageId     String?          // ID пакета кредитов
  metadata      Json?            // Дополнительные данные (форма оплаты, etc)
  description   String?
  createdAt     DateTime         @default(now())
  completedAt   DateTime?
}
```

**CreditPackage model:**
```prisma
model CreditPackage {
  id            String   @id @default(cuid())
  name          String
  credits       Float
  price         Float
  priceYooMoney Float?   // Цена в рублях для YooMoney
  priceStars    Int?     // Цена в Telegram Stars
  priceCrypto   Float?   // Цена в USDT
  discount      Int      @default(0)
  popular       Boolean  @default(false)
  active        Boolean  @default(true)
}
```

## Тестирование

### 1. Тестирование локально

Для тестирования webhook локально используйте ngrok:

```bash
ngrok http 3000
```

Используйте полученный URL для настройки webhook в YooMoney:
```
https://your-ngrok-url.ngrok.io/payment/yoomoney/notification
```

### 2. Проверка flow

1. Запустите бота локально:
```bash
npm run start:dev
```

2. В Telegram отправьте `/start`
3. Выберите "💎 Купить кредиты"
4. Выберите пакет
5. Выберите "💳 YooMoney"
6. Перейдите по ссылке оплаты
7. Произведите тестовый платеж
8. Проверьте, что кредиты зачислились

### 3. Проверка webhook

Для проверки webhook можно использовать curl:

```bash
curl -X POST http://localhost:3000/payment/yoomoney/notification \
  -H "Content-Type: application/json" \
  -d '{
    "notification_type": "p2p-incoming",
    "operation_id": "test_operation_123",
    "amount": "99.00",
    "currency": "643",
    "datetime": "2025-01-18T12:00:00Z",
    "sender": "test_sender",
    "codepro": "false",
    "label": "your_payment_id_here",
    "sha1_hash": "calculated_hash_here"
  }'
```

## Troubleshooting

### Webhook не приходит
1. Проверьте, что HTTP уведомления включены в настройках YooMoney
2. Проверьте URL webhook - он должен быть доступен из интернета
3. Проверьте логи сервера на наличие ошибок

### Неверная подпись (signature mismatch)
1. Проверьте, что `YOOMONEY_SECRET` совпадает с секретным словом в настройках HTTP уведомлений
2. Проверьте порядок полей в хэше (см. код в `payment.service.ts:256`)

### Платеж не зачисляется
1. Проверьте статус транзакции в БД
2. Проверьте логи на наличие ошибок
3. Убедитесь, что `label` в уведомлении совпадает с `paymentId` в транзакции

### Кредиты не зачисляются
1. Проверьте, что транзакция имеет статус `COMPLETED`
2. Проверьте логи `CreditsService`
3. Проверьте баланс пользователя в БД: `SELECT * FROM "User" WHERE telegramId = ...`

## Security

1. **Всегда проверяйте подпись webhook** - код в `payment.service.ts:256-273`
2. **Используйте HTTPS** для production
3. **Не храните секретные ключи в коде** - используйте переменные окружения
4. **Логируйте все платежные операции** для аудита

## Мониторинг

Рекомендуется настроить мониторинг для:
- Неуспешных платежей (`TransactionStatus.FAILED`)
- Webhook ошибок (неверная подпись)
- Зависших платежей (статус `PENDING` более 1 часа)

## Дополнительные ресурсы

- [YooMoney API Documentation](https://yoomoney.ru/docs/wallet)
- [HTTP Notifications Setup](https://yoomoney.ru/transfer/myservices/http-notification)
- [OAuth Services](https://yoomoney.ru/settings/oauth-services)
