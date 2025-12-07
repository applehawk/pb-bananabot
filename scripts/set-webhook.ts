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
const SECRET_TOKEN = process.env.TELEGRAM_WEBHOOK_SECRET || process.env.TELEGRAM_SECRET_TOKEN;

// Optional configuration
const MAX_CONNECTIONS = process.env.WEBHOOK_MAX_CONNECTIONS
  ? parseInt(process.env.WEBHOOK_MAX_CONNECTIONS, 10)
  : undefined;
const ALLOWED_UPDATES = process.env.WEBHOOK_ALLOWED_UPDATES
  ? JSON.parse(process.env.WEBHOOK_ALLOWED_UPDATES)
  : undefined;
const IP_ADDRESS = process.env.WEBHOOK_IP_ADDRESS;
const DROP_PENDING_UPDATES = process.env.WEBHOOK_DROP_PENDING_UPDATES === 'true';

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

const args = process.argv.slice(2);
const isDelete = args.includes('delete') || args.includes('--delete');

(async () => {
  try {
    if (isDelete) {
      console.log(`� Deleting webhook...`);
      if (DROP_PENDING_UPDATES) console.log(`  Drop Pending Updates: true`);

      await bot.api.deleteWebhook({
        drop_pending_updates: DROP_PENDING_UPDATES
      });
      console.log('✅ Webhook deleted successfully');
    } else {
      console.log(`�🔄 Setting webhook to: ${webhookUrl}`);
      if (MAX_CONNECTIONS) console.log(`  Max Connections: ${MAX_CONNECTIONS}`);
      if (ALLOWED_UPDATES) console.log(`  Allowed Updates: ${JSON.stringify(ALLOWED_UPDATES)}`);
      if (IP_ADDRESS) console.log(`  IP Address: ${IP_ADDRESS}`);
      if (DROP_PENDING_UPDATES) console.log(`  Drop Pending Updates: true`);

      await bot.api.setWebhook(webhookUrl, {
        secret_token: SECRET_TOKEN,
        max_connections: MAX_CONNECTIONS,
        allowed_updates: ALLOWED_UPDATES,
        ip_address: IP_ADDRESS,
        drop_pending_updates: DROP_PENDING_UPDATES,
      });

      console.log('✅ Webhook set successfully');
    }

    // Verify webhook (check status after operation)
    const webhookInfo = await bot.api.getWebhookInfo();
    console.log('\n📋 Webhook Info:');
    console.log(`  URL: ${webhookInfo.url || '(none)'}`);
    console.log(
      `  Has Secret Token: ${webhookInfo.has_custom_certificate ? 'Yes' : 'No'}`,
    );
    console.log(`  Pending Updates: ${webhookInfo.pending_update_count}`);
    if (webhookInfo.max_connections) {
      console.log(`  Max Connections: ${webhookInfo.max_connections}`);
    }
    if (webhookInfo.allowed_updates) {
      console.log(`  Allowed Updates: ${JSON.stringify(webhookInfo.allowed_updates)}`);
    }
    if (webhookInfo.ip_address) {
      console.log(`  IP Address: ${webhookInfo.ip_address}`);
    }


    if (webhookInfo.last_error_date) {
      console.log(`\n⚠️  Last Error: ${webhookInfo.last_error_message}`);
      console.log(
        `   Date: ${new Date(webhookInfo.last_error_date * 1000).toISOString()}`,
      );
    }
  } catch (error) {
    console.error(`❌ Failed to ${isDelete ? 'delete' : 'set'} webhook:`, error);
    process.exit(1);
  }
})();
