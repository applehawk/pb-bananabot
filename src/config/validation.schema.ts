import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  APP_NAME: Joi.string().default('AI Image Generator Bot'),

  // Telegram
  TELEGRAM_BOT_TOKEN: Joi.string().required(),
  TELEGRAM_WEBHOOK_URL: Joi.string().uri().optional(),
  TELEGRAM_WEBHOOK_SECRET: Joi.string().optional(),
  BOT_ADMIN_IDS: Joi.string().optional(),

  // Gemini
  GEMINI_API_KEY: Joi.string().required(),
  GEMINI_MODEL: Joi.string().default('gemini-2.5-flash-image'),
  GEMINI_MAX_RETRIES: Joi.number().default(3),
  GEMINI_TIMEOUT: Joi.number().default(60000),

  // Database
  DATABASE_URL: Joi.string().required(),

  // Redis
  REDIS_URL: Joi.string().optional(),
  REDIS_ENABLED: Joi.boolean().default(false),

  // Payment - YooMoney
  YOOMONEY_TOKEN: Joi.string().optional(),
  YOOMONEY_SHOP_ID: Joi.string().optional(),
  YOOMONEY_SECRET: Joi.string().optional(),
  YOOMONEY_WALLET: Joi.string().optional(),
  YOOMONEY_SUCCESS_URL: Joi.string().uri().optional(),

  // Payment - Telegram Stars
  TELEGRAM_PAYMENTS_PROVIDER_TOKEN: Joi.string().optional(),

  // Payment - Crypto
  CRYPTOBOT_API_TOKEN: Joi.string().optional(),
  CRYPTOBOT_WEBHOOK_SECRET: Joi.string().optional(),

  // Storage
  STORAGE_TYPE: Joi.string().valid('s3', 'r2').default('s3'),
  AWS_ACCESS_KEY_ID: Joi.string().when('STORAGE_TYPE', {
    is: 's3',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  AWS_SECRET_ACCESS_KEY: Joi.string().when('STORAGE_TYPE', {
    is: 's3',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  AWS_REGION: Joi.string().default('us-east-1'),
  AWS_S3_BUCKET: Joi.string().when('STORAGE_TYPE', {
    is: 's3',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  AWS_S3_PUBLIC_URL: Joi.string().optional(),

  R2_ACCOUNT_ID: Joi.string().when('STORAGE_TYPE', {
    is: 'r2',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  R2_ACCESS_KEY_ID: Joi.string().when('STORAGE_TYPE', {
    is: 'r2',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  R2_SECRET_ACCESS_KEY: Joi.string().when('STORAGE_TYPE', {
    is: 'r2',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  R2_BUCKET_NAME: Joi.string().when('STORAGE_TYPE', {
    is: 'r2',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  R2_PUBLIC_URL: Joi.string().optional(),

  // Credits & Pricing
  FREE_CREDITS: Joi.number().default(3),
  TEXT_TO_IMAGE_COST: Joi.number().default(1),
  IMAGE_TO_IMAGE_COST: Joi.number().default(1.5),
  MULTI_IMAGE_2_4_COST: Joi.number().default(2),
  MULTI_IMAGE_5_16_COST: Joi.number().default(3),
  BATCH_MULTIPLIER: Joi.number().default(1),

  // Referral
  REFERRAL_BONUS_NEW_USER: Joi.number().default(2),
  REFERRAL_BONUS_REFERRER: Joi.number().default(3),
  REFERRAL_FIRST_PURCHASE_BONUS: Joi.number().default(5),

  // Daily Bonus
  DAILY_BONUS_DAY_1: Joi.number().default(0.5),
  DAILY_BONUS_DAY_3: Joi.number().default(1),
  DAILY_BONUS_DAY_7: Joi.number().default(2),
  DAILY_BONUS_DAY_30: Joi.number().default(5),

  // Rate Limiting
  RATE_LIMIT_PER_MINUTE: Joi.number().default(10),
  RATE_LIMIT_GLOBAL: Joi.number().default(100),

  // Generation
  MAX_IMAGES_PER_REQUEST: Joi.number().default(16),
  MAX_BATCH_SIZE: Joi.number().default(4),
  DEFAULT_ASPECT_RATIO: Joi.string().default('1:1'),
  GENERATION_TIMEOUT: Joi.number().default(60000),

  // Image
  MAX_IMAGE_SIZE_MB: Joi.number().default(10),
  IMAGE_QUALITY: Joi.number().default(90),
  THUMBNAIL_SIZE: Joi.number().default(300),

  // Logging
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info'),
  LOG_PRETTY: Joi.boolean().default(true),

  // Sentry
  SENTRY_DSN: Joi.string().optional(),
  SENTRY_ENABLED: Joi.boolean().default(false),

  // Security
  JWT_SECRET: Joi.string().optional(),
  API_KEY: Joi.string().optional(),

  // Features
  ENABLE_MULTI_IMAGE: Joi.boolean().default(true),
  ENABLE_BATCH_GENERATION: Joi.boolean().default(true),
  ENABLE_REFERRAL_SYSTEM: Joi.boolean().default(true),
  ENABLE_DAILY_BONUS: Joi.boolean().default(true),
  ENABLE_PROMO_CODES: Joi.boolean().default(true),
  ENABLE_ANALYTICS: Joi.boolean().default(true),
});
