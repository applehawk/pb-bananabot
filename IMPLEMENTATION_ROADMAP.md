# AI Image Generation Bot - Implementation Roadmap

## Completed
- [x] Prisma Schema (полная схема БД для генерации изображений)
- [x] .env.example (конфигурация всех переменных окружения)
- [x] Configuration Module (configuration.ts, validation.schema.ts)
- [x] Database Module (Prisma Service)

## Phase 1: Core Infrastructure (2-3 days)
- [ ] User Module
  - [ ] user.service.ts - CRUD для пользователей + кредиты
  - [ ] user.module.ts
  - [ ] dto/create-user.dto.ts
  
- [ ] Credits Module
  - [ ] credits.service.ts - логика начисления/списания кредитов
  - [ ] transactions.service.ts - история транзакций
  - [ ] credits.module.ts

## Phase 2: Gemini Integration (1-2 days)
- [ ] Gemini Module
  - [ ] gemini.service.ts - интеграция с @google/generative-ai
  - [ ] dto/generate-image.dto.ts
  - [ ] dto/image-params.dto.ts
  - [ ] utils/prompt-enhancer.util.ts
  - [ ] gemini.module.ts

## Phase 3: Image Generation (2-3 days)
- [ ] Generation Module
  - [ ] generation.service.ts - orchestration генерации
  - [ ] storage/image-storage.service.ts - S3/R2 upload
  - [ ] generation.module.ts

## Phase 4: Telegram Bot Core (2-3 days)
- [ ] Telegram Module
  - [ ] telegram.service.ts (аналог grammy.service.ts)
  - [ ] bot.provider.ts - Grammy Bot instance
  - [ ] telegram-context.interface.ts
  - [ ] telegram.module.ts

- [ ] Bot Commands
  - [ ] commands/start.command.ts
  - [ ] commands/generate.command.ts
  - [ ] commands/balance.command.ts
  - [ ] commands/settings.command.ts
  - [ ] commands/buy.command.ts
  - [ ] commands/history.command.ts
  - [ ] commands/help.command.ts

## Phase 5: Handlers (2 days)
- [ ] Telegram Handlers
  - [ ] handlers/text-message.handler.ts - обработка промптов
  - [ ] handlers/photo.handler.ts - image-to-image
  - [ ] handlers/callback.handler.ts - inline buttons

- [ ] Middlewares
  - [ ] middlewares/auth.middleware.ts
  - [ ] middlewares/rate-limit.middleware.ts
  - [ ] middlewares/logging.middleware.ts

## Phase 6: Payment System (2-3 days)
- [ ] Адаптация существующей Payment Module
  - [ ] Добавить стратегии для Telegram Stars
  - [ ] Добавить стратегии для Crypto
  - [ ] Обновить payment.service.ts для работы с кредитами
  - [ ] webhooks/payment-webhook.controller.ts

## Phase 7: Conversations (2-3 days)
- [ ] Telegram Conversations
  - [ ] conversations/generate-image.conversation.ts
  - [ ] conversations/settings.conversation.ts
  - [ ] conversations/payment.conversation.ts

## Phase 8: Referral & Bonuses (1-2 days)
- [ ] Referral Module
  - [ ] referral.service.ts
  - [ ] referral.module.ts

- [ ] Daily Bonus
  - [ ] Добавить логику в credits.service.ts
  - [ ] Scheduler для daily bonuses

## Phase 9: Docker & Deployment (1 day)
- [ ] Dockerfile
- [ ] docker-compose.yml (app, postgres, redis)
- [ ] nginx.conf (для production)
- [ ] .dockerignore

## Phase 10: Documentation (1 day)
- [ ] README.md - полная инструкция по установке
- [ ] API.md - описание API endpoints
- [ ] DEPLOYMENT.md - инструкции по деплою
- [ ] USER_GUIDE.md - руководство пользователя бота

## Phase 11: Testing (2 days)
- [ ] Unit tests для ключевых сервисов
- [ ] E2E tests для команд бота
- [ ] Integration tests для Gemini API

## Critical Files для первого запуска:

### Минимальный набор для работы (MVP):
1. src/main.ts - точка входа
2. src/app.module.ts - root module
3. src/user/user.service.ts
4. src/user/user.module.ts
5. src/credits/credits.service.ts
6. src/credits/credits.module.ts
7. src/gemini/gemini.service.ts
8. src/gemini/gemini.module.ts
9. src/generation/generation.service.ts
10. src/generation/generation.module.ts
11. src/telegram/telegram.service.ts
12. src/telegram/bot.provider.ts
13. src/telegram/telegram.module.ts
14. src/telegram/commands/start.command.ts
15. src/telegram/commands/generate.command.ts
16. src/telegram/handlers/text-message.handler.ts

## Estimated Timeline: 15-20 days

## Next Immediate Steps:
1. Create User Module (2-3 hours)
2. Create Credits Module (2-3 hours)
3. Create Gemini Module (3-4 hours)
4. Create Generation Module (3-4 hours)
5. Create Telegram Bot Core (4-5 hours)
6. Wire everything in app.module.ts
7. Test basic text-to-image generation

## Priority Order:
1. Database & User Management (HIGH)
2. Gemini Integration (HIGH)
3. Basic Bot Commands (HIGH)
4. Text-to-Image Generation (HIGH)
5. Image-to-Image (MEDIUM)
6. Payment Integration (MEDIUM)
7. Conversations (LOW)
8. Referral System (LOW)
