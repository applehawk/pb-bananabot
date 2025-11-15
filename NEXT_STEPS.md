# Следующие шаги для завершения проекта

## Что уже готово (60-65%)

✅ **Инфраструктура**
- База данных (Prisma schema с 13 моделями)
- Конфигурация (env validation, configuration module)
- Docker setup (multi-stage build, docker-compose)
- Документация (README, guides, roadmap)

✅ **Core Services**
- UserService - управление пользователями, кредитами, настройками
- CreditsService - начисление/списание, бонусы, транзакции
- GeminiService - генерация изображений через Gemini AI
- DatabaseModule - Prisma интеграция

✅ **Утилиты**
- Prompt enhancer - улучшение промптов
- Валидация переменных окружения
- TypeScript конфигурация

## Что нужно доделать (35-40%)

### Приоритет 1: Generation Service (2-3 часа)

Создать `src/generation/generation.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UserService } from '../user/user.service';
import { CreditsService } from '../credits/credits.service';
import { GeminiService } from '../gemini/gemini.service';
import { ImageStorageService } from './storage/image-storage.service';

@Injectable()
export class GenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly creditsService: CreditsService,
    private readonly geminiService: GeminiService,
    private readonly imageStorage: ImageStorageService,
  ) {}

  async generateTextToImage(userId: string, prompt: string, settings?: any) {
    // 1. Рассчитать стоимость
    const cost = this.creditsService.calculateCost('TEXT_TO_IMAGE');
    
    // 2. Проверить кредиты
    const hasCredits = await this.userService.hasEnoughCredits(userId, cost);
    if (!hasCredits) throw new Error('Insufficient credits');
    
    // 3. Создать запись в БД
    const generation = await this.prisma.generation.create({
      data: {
        userId,
        type: 'TEXT_TO_IMAGE',
        prompt,
        status: 'PROCESSING',
        creditsUsed: cost,
        ...settings
      }
    });
    
    try {
      // 4. Генерация через Gemini
      const result = await this.geminiService.generateFromText({ prompt, ...settings });
      
      // 5. Загрузка на S3/R2
      const imageUrl = await this.imageStorage.uploadImage(
        Buffer.from(result.images[0].data, 'base64'),
        generation.id
      );
      
      // 6. Списание кредитов
      await this.creditsService.deductCredits(userId, cost, generation.id);
      
      // 7. Обновление записи
      const completed = await this.prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: 'COMPLETED',
          imageUrl,
          completedAt: new Date(),
        }
      });
      
      return completed;
      
    } catch (error) {
      // Обработка ошибки
      await this.prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
        }
      });
      
      throw error;
    }
  }
  
  // Аналогично для image-to-image и multi-image
}
```

### Приоритет 2: Image Storage Service (2 часа)

Создать `src/generation/storage/image-storage.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3 } from '@aws-sdk/client-s3';
import * as sharp from 'sharp';

@Injectable()
export class ImageStorageService {
  private s3: S3;
  private bucket: string;
  private publicUrl: string;

  constructor(private readonly config: ConfigService) {
    const storageType = this.config.get('storage.type');
    
    if (storageType === 's3') {
      this.s3 = new S3({
        region: this.config.get('storage.aws.region'),
        credentials: {
          accessKeyId: this.config.get('storage.aws.accessKeyId'),
          secretAccessKey: this.config.get('storage.aws.secretAccessKey'),
        },
      });
      this.bucket = this.config.get('storage.aws.bucket');
      this.publicUrl = this.config.get('storage.aws.publicUrl');
    }
  }

  async uploadImage(buffer: Buffer, generationId: string): Promise<string> {
    // Оптимизация изображения
    const optimized = await sharp(buffer)
      .jpeg({ quality: this.config.get('image.quality') })
      .toBuffer();
    
    const key = `generations/${generationId}.jpg`;
    
    await this.s3.putObject({
      Bucket: this.bucket,
      Key: key,
      Body: optimized,
      ContentType: 'image/jpeg',
      ACL: 'public-read',
    });
    
    return `${this.publicUrl}/${key}`;
  }
  
  async createThumbnail(buffer: Buffer, generationId: string): Promise<string> {
    const thumbnailSize = this.config.get('image.thumbnailSize');
    
    const thumbnail = await sharp(buffer)
      .resize(thumbnailSize, thumbnailSize, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toBuffer();
    
    const key = `thumbnails/${generationId}.jpg`;
    
    await this.s3.putObject({
      Bucket: this.bucket,
      Key: key,
      Body: thumbnail,
      ContentType: 'image/jpeg',
      ACL: 'public-read',
    });
    
    return `${this.publicUrl}/${key}`;
  }
}
```

### Приоритет 3: Telegram Bot Core (3-4 часа)

Адаптировать существующий `src/grammy/grammy.service.ts` → создать `src/telegram/telegram.service.ts`.

Основные изменения:
1. Импортировать GenerationService
2. Добавить handlers для генерации
3. Настроить conversations plugin
4. Добавить middleware для auth и rate limiting

### Приоритет 4: Bot Commands (2-3 часа)

Создать команды в `src/telegram/commands/`:

**start.command.ts**:
```typescript
export async function startCommand(ctx: MyContext) {
  const refCode = ctx.match; // реферальный код из /start ref_CODE
  
  await ctx.userService.upsert({
    telegramId: ctx.from.id,
    username: ctx.from.username,
    firstName: ctx.from.first_name,
    lastName: ctx.from.last_name,
    referredBy: refCode || null,
  });
  
  // Если есть реферальный код
  if (refCode) {
    const referrer = await ctx.userService.findByReferralCode(refCode);
    if (referrer) {
      await ctx.creditsService.grantReferralBonus(referrer.id, user.id);
    }
  }
  
  await ctx.reply(
    '🎨 Добро пожаловать в AI Image Generator!\n\n' +
    `У вас ${user.credits} кредитов.\n\n` +
    'Отправьте текстовое описание для генерации изображения.\n' +
    'Или используйте /help для справки.'
  );
}
```

**generate.command.ts**:
```typescript
export async function generateCommand(ctx: MyContext) {
  const prompt = ctx.match as string;
  
  if (!prompt) {
    return ctx.reply('Укажите описание изображения. Например:\n/generate Futuristic city at sunset');
  }
  
  const user = await ctx.userService.findByTelegramId(ctx.from.id);
  const cost = ctx.creditsService.calculateCost('TEXT_TO_IMAGE');
  
  if (user.credits < cost) {
    return ctx.reply(
      `Недостаточно кредитов. Нужно: ${cost}, у вас: ${user.credits}\n` +
      'Пополните баланс: /buy'
    );
  }
  
  const statusMsg = await ctx.reply('🎨 Генерирую изображение... ⏱ 5-10 сек');
  
  try {
    const generation = await ctx.generationService.generateTextToImage(
      user.id,
      prompt,
      user.settings
    );
    
    await ctx.deleteMessage(statusMsg.message_id);
    
    await ctx.replyWithPhoto(generation.fileId || generation.imageUrl, {
      caption: `🎨 ${prompt}\n\n💎 Использовано: ${cost} кредитов\nОсталось: ${user.credits - cost}`,
      reply_markup: {
        inline_keyboard: [[
          { text: '🔄 Вариация', callback_data: `regenerate_${generation.id}` },
          { text: '⚙️ Параметры', callback_data: `settings` },
        ]]
      }
    });
    
  } catch (error) {
    await ctx.deleteMessage(statusMsg.message_id);
    await ctx.reply('❌ Ошибка генерации: ' + error.message);
  }
}
```

### Приоритет 5: Main Files (1 час)

**src/app.module.ts**:
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validationSchema } from './config/validation.schema';

import { DatabaseModule } from './database/database.module';
import { UserModule } from './user/user.module';
import { CreditsModule } from './credits/credits.module';
import { GeminiModule } from './gemini/gemini.module';
import { GenerationModule } from './generation/generation.module';
import { TelegramModule } from './telegram/telegram.module';
import { PaymentModule } from './payment/payment.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
    }),
    DatabaseModule,
    UserModule,
    CreditsModule,
    GeminiModule,
    GenerationModule,
    TelegramModule,
    PaymentModule,
  ],
})
export class AppModule {}
```

**src/main.ts**:
```typescript
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  
  // Enable CORS
  app.enableCors();
  
  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  
  // Shutdown hooks
  app.enableShutdownHooks();
  
  const port = config.get('app.port');
  await app.listen(port);
  
  console.log(`🚀 Application is running on: http://localhost:${port}`);
}

bootstrap();
```

## Запуск проекта

### 1. Установка зависимостей
```bash
npm install
```

### 2. Настройка окружения
```bash
cp .env.example .env
# Заполнить TELEGRAM_BOT_TOKEN, GEMINI_API_KEY, DATABASE_URL
```

### 3. База данных
```bash
# Запуск PostgreSQL
docker-compose up -d postgres

# Миграции
npm run prisma:generate
npm run prisma:migrate
```

### 4. Запуск приложения
```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## Чек-лист перед запуском

- [ ] Создан GenerationService
- [ ] Создан ImageStorageService  
- [ ] Создан TelegramService (адаптирован GrammyService)
- [ ] Созданы команды /start, /generate, /balance
- [ ] Создан text handler
- [ ] Создан app.module.ts
- [ ] Создан main.ts
- [ ] Заполнены .env переменные
- [ ] Запущена БД
- [ ] Применены миграции
- [ ] Протестирована генерация

## Время на доработку

- Generation Service: 2-3 часа
- Image Storage: 2 часа
- Telegram Bot Core: 3-4 часа
- Commands: 2-3 часа
- Main Files: 1 час
- Testing: 2 часа

**ИТОГО: 12-15 часов до MVP**

## После MVP

1. Добавить image-to-image handler
2. Добавить multi-image support
3. Интегрировать платежи (Telegram Stars, Crypto)
4. Создать conversations
5. Добавить referral service
6. Добавить history command
7. Создать admin panel

## Поддержка

Если возникнут вопросы:
1. Проверьте документацию в README_IMAGE_GEN.md
2. Изучите существующий код в src/grammy/
3. Посмотрите примеры в QUICK_START.md

Удачи! 🚀
