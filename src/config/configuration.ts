export default () => ({
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 3000,
    name: process.env.APP_NAME || 'AI Image Generator Bot',
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
    adminIds:
      process.env.BOT_ADMIN_IDS?.split(',').map((id) => parseInt(id, 10)) || [],
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash-image',
    maxRetries: parseInt(process.env.GEMINI_MAX_RETRIES, 10) || 3,
    timeout: parseInt(process.env.GEMINI_TIMEOUT, 10) || 60000,
  },

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    url: process.env.REDIS_URL,
    enabled: process.env.REDIS_ENABLED === 'true',
  },

  payment: {
    yoomoney: {
      token: process.env.YOOMONEY_TOKEN,
      shopId: process.env.YOOMONEY_SHOP_ID,
      secret: process.env.YOOMONEY_SECRET,
      wallet: process.env.YOOMONEY_WALLET,
    },
    telegramStars: {
      providerToken: process.env.TELEGRAM_PAYMENTS_PROVIDER_TOKEN,
    },
    crypto: {
      apiToken: process.env.CRYPTOBOT_API_TOKEN,
      webhookSecret: process.env.CRYPTOBOT_WEBHOOK_SECRET,
    },
  },

  storage: {
    type: process.env.STORAGE_TYPE || 's3',
    aws: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1',
      bucket: process.env.AWS_S3_BUCKET,
      publicUrl: process.env.AWS_S3_PUBLIC_URL,
    },
    r2: {
      accountId: process.env.R2_ACCOUNT_ID,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      bucketName: process.env.R2_BUCKET_NAME,
      publicUrl: process.env.R2_PUBLIC_URL,
    },
  },

  credits: {
    free: parseFloat(process.env.FREE_CREDITS) || 3,
    costs: {
      textToImage: parseFloat(process.env.TEXT_TO_IMAGE_COST) || 1,
      imageToImage: parseFloat(process.env.IMAGE_TO_IMAGE_COST) || 1.5,
      multiImage2to4: parseFloat(process.env.MULTI_IMAGE_2_4_COST) || 2,
      multiImage5to16: parseFloat(process.env.MULTI_IMAGE_5_16_COST) || 3,
      batchMultiplier: parseFloat(process.env.BATCH_MULTIPLIER) || 1,
    },
  },

  referral: {
    bonusNewUser: parseFloat(process.env.REFERRAL_BONUS_NEW_USER) || 2,
    bonusReferrer: parseFloat(process.env.REFERRAL_BONUS_REFERRER) || 3,
    firstPurchaseBonus:
      parseFloat(process.env.REFERRAL_FIRST_PURCHASE_BONUS) || 5,
  },

  dailyBonus: {
    day1: parseFloat(process.env.DAILY_BONUS_DAY_1) || 0.5,
    day3: parseFloat(process.env.DAILY_BONUS_DAY_3) || 1,
    day7: parseFloat(process.env.DAILY_BONUS_DAY_7) || 2,
    day30: parseFloat(process.env.DAILY_BONUS_DAY_30) || 5,
  },

  rateLimit: {
    perMinute: parseInt(process.env.RATE_LIMIT_PER_MINUTE, 10) || 10,
    global: parseInt(process.env.RATE_LIMIT_GLOBAL, 10) || 100,
  },

  generation: {
    maxImagesPerRequest: parseInt(process.env.MAX_IMAGES_PER_REQUEST, 10) || 16,
    maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE, 10) || 4,
    defaultAspectRatio: process.env.DEFAULT_ASPECT_RATIO || '1:1',
    timeout: parseInt(process.env.GENERATION_TIMEOUT, 10) || 60000,
  },

  image: {
    maxSizeMB: parseInt(process.env.MAX_IMAGE_SIZE_MB, 10) || 10,
    quality: parseInt(process.env.IMAGE_QUALITY, 10) || 90,
    thumbnailSize: parseInt(process.env.THUMBNAIL_SIZE, 10) || 300,
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    pretty: process.env.LOG_PRETTY === 'true',
  },

  sentry: {
    dsn: process.env.SENTRY_DSN,
    enabled: process.env.SENTRY_ENABLED === 'true',
  },

  security: {
    jwtSecret: process.env.JWT_SECRET,
    apiKey: process.env.API_KEY,
  },

  features: {
    multiImage: process.env.ENABLE_MULTI_IMAGE === 'true',
    batchGeneration: process.env.ENABLE_BATCH_GENERATION === 'true',
    referralSystem: process.env.ENABLE_REFERRAL_SYSTEM === 'true',
    dailyBonus: process.env.ENABLE_DAILY_BONUS === 'true',
    promoCodes: process.env.ENABLE_PROMO_CODES === 'true',
    analytics: process.env.ENABLE_ANALYTICS === 'true',
  },
});
