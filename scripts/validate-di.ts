import * as dotenv from 'dotenv';
dotenv.config();

// Set defaults for local execution if not present in .env
process.env.DATABASE_HOST = process.env.DATABASE_HOST || 'localhost';
process.env.DATABASE_PORT = process.env.DATABASE_PORT || '5432';
process.env.DATABASE_USER = process.env.DATABASE_USER || 'bananabot';
process.env.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD || 'bananabot_secret';
process.env.DATABASE_NAME = process.env.DATABASE_NAME || 'bananabot';

import { NestFactory } from '@nestjs/core';
import { BotModule } from '../src/grammy/bot.module';

async function bootstrap() {
    console.log('Validating Dependency Injection...');
    try {
        // Create the application context without starting the server
        const app = await NestFactory.createApplicationContext(BotModule, { logger: false });
        await app.init();
        await app.close();
        console.log('✅ DI Validation Passed!');
        process.exit(0);
    } catch (error) {
        if (error.constructor.name === 'PrismaClientInitializationError') {
            console.log('⚠️  Database connection failed (expected if DB is not running locally).');
            console.log('✅ DI Validation Passed! (App initialized, but DB unreachable)');
            process.exit(0);
        }
        console.error('❌ DI Validation Failed!');
        console.error(error);
        process.exit(1);
    }
}

bootstrap();
