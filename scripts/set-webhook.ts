#!/usr/bin/env ts-node

/**
 * Webhook Setup Script
 *
 * Run this script once when deploying to production:
 * npx ts-node scripts/set-webhook.ts
 *
 * Make sure these environment variables are set:
 * - BOT_TOKEN: Your Telegram bot token
 * - DOMAIN: Your production domain (e.g., example.com)
 * - TELEGRAM_SECRET_TOKEN (optional): Secret for webhook validation
 */

import { Bot } from 'grammy';
import * as dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const DOMAIN = process.env.DOMAIN;
const SECRET_TOKEN = process.env.TELEGRAM_SECRET_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN not set in environment');
  process.exit(1);
}

if (!DOMAIN) {
  console.error('❌ DOMAIN not set in environment');
  process.exit(1);
}

const bot = new Bot(BOT_TOKEN);
const webhookUrl = `https://${DOMAIN}/telegram/webhook`;

(async () => {
  try {
    console.log(`🔄 Setting webhook to: ${webhookUrl}`);

    await bot.api.setWebhook(webhookUrl, {
      secret_token: SECRET_TOKEN,
      drop_pending_updates: true, // Clear pending updates on webhook change
    });

    console.log('✅ Webhook set successfully');

    // Verify webhook
    const webhookInfo = await bot.api.getWebhookInfo();
    console.log('\n📋 Webhook Info:');
    console.log(`  URL: ${webhookInfo.url}`);
    console.log(`  Has Secret Token: ${webhookInfo.has_custom_certificate ? 'Yes' : 'No'}`);
    console.log(`  Pending Updates: ${webhookInfo.pending_update_count}`);
    console.log(`  Max Connections: ${webhookInfo.max_connections}`);

    if (webhookInfo.last_error_date) {
      console.log(`\n⚠️  Last Error: ${webhookInfo.last_error_message}`);
      console.log(`   Date: ${new Date(webhookInfo.last_error_date * 1000).toISOString()}`);
    }
  } catch (error) {
    console.error('❌ Failed to set webhook:', error);
    process.exit(1);
  }
})();