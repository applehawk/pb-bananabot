const https = require('https');

const BOT_TOKEN = '6716771585:AAEnPG4TAds-h2xEW8mdgMGRnwweqel3F6w';

// Get bot info
function getBotInfo() {
  return new Promise((resolve, reject) => {
    https.get(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const parsed = JSON.parse(data);
        resolve(parsed);
      });
    }).on('error', reject);
  });
}

// Get updates
function getUpdates(offset = 0) {
  return new Promise((resolve, reject) => {
    https.get(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=30`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const parsed = JSON.parse(data);
        resolve(parsed);
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('🤖 Testing Telegram Bot...\n');

  // 1. Check bot info
  const botInfo = await getBotInfo();
  if (botInfo.ok) {
    console.log('✅ Bot is active:');
    console.log(`   Username: @${botInfo.result.username}`);
    console.log(`   Name: ${botInfo.result.first_name}`);
    console.log(`   ID: ${botInfo.result.id}\n`);
  } else {
    console.error('❌ Bot is not accessible');
    return;
  }

  // 2. Try to get updates
  console.log('📡 Checking for updates...');
  const updates = await getUpdates();

  if (updates.ok) {
    console.log(`✅ Received ${updates.result.length} updates\n`);

    if (updates.result.length === 0) {
      console.log('ℹ️  No pending updates. Please send /start to the bot in Telegram now.');
      console.log('   Bot: @' + botInfo.result.username);
      console.log('\n⏳ Waiting for updates (30 seconds)...\n');

      const newUpdates = await getUpdates();
      if (newUpdates.ok && newUpdates.result.length > 0) {
        console.log(`✅ Received ${newUpdates.result.length} new updates!\n`);
        newUpdates.result.forEach((update, i) => {
          console.log(`Update #${i + 1}:`);
          console.log(JSON.stringify(update, null, 2));
        });
      } else {
        console.log('❌ No updates received. Make sure you sent /start to @' + botInfo.result.username);
      }
    } else {
      updates.result.forEach((update, i) => {
        console.log(`Update #${i + 1}:`);
        console.log(JSON.stringify(update, null, 2));
      });
    }
  } else {
    console.error('❌ Failed to get updates');
  }
}

main().catch(console.error);
