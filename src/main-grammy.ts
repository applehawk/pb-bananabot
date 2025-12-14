import { NestFactory, ModulesContainer } from '@nestjs/core';
import { BotModule } from './grammy/bot.module';
import { Logger } from '@nestjs/common';
import { SpelunkerModule } from 'nestjs-spelunker';
import { WinstonModule, utilities as nestWinstonUtilities } from 'nest-winston';
import * as winston from 'winston';
import { DebugService } from './debug/debug.service';

async function bootstrap() {
  const isDev = process.env.NODE_ENV !== 'production';

  // Development only: Disable TLS verification for local testing
  // WARNING: Never use in production!
  if (isDev && process.env.DISABLE_TLS_VERIFY === 'true') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    Logger.warn(
      '⚠️  TLS certificate verification is DISABLED (development only)',
      'Security',
    );
  }

  // Create logs directory if not exists
  const fs = await import('fs');
  if (!fs.existsSync('./logs')) {
    fs.mkdirSync('./logs');
  }

  const app = await NestFactory.create(BotModule, {
    logger: WinstonModule.createLogger({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.ms(),
            nestWinstonUtilities.format.nestLike('BananaBot', {
              colors: true,
              prettyPrint: true,
            }),
          ),
        }),
        new winston.transports.File({
          filename: 'logs/bot.log',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      ],
    }),
  });

  // Enable CORS with security-conscious defaults
  app.enableCors({
    origin: isDev ? '*' : process.env.ALLOWED_ORIGINS?.split(',') || false,
    credentials: true,
  });

  const port = process.env.PORT || 80;
  await app.listen(port);
  Logger.log(`🚀 BananaBot (grammY) running on port ${port}`, 'Bootstrap');
  Logger.log(`📡 Mode: ${process.env.NODE_ENV || 'development'}`, 'Bootstrap');

  // Debug: Check if providers are initialized
  Logger.log('Checking provider initialization...', 'Bootstrap');

  // Visualization: Generate dependency graph
  try {
    const tree = SpelunkerModule.explore(app);

    // ENRICHMENT: Standard providers don't show constructor injections in Spelunker by default.
    // We manually inspecting the ModulesContainer to find them via Reflect metadata.
    const modulesContainer = app.get(ModulesContainer);
    const modules = [...modulesContainer.values()];

    tree.forEach((moduleNode) => {
      const moduleRef = modules.find((m) => m.metatype.name === moduleNode.name);
      if (!moduleRef) return;

      for (const [token, details] of Object.entries(moduleNode.providers)) {
        if (details.method === 'standard') {
          const providerWrapper = [...moduleRef.providers.values()].find(
            (p) =>
              p.name === token ||
              (typeof p.token === 'function' && p.token.name === token),
          );

          if (providerWrapper && providerWrapper.metatype) {
            const paramTypes = Reflect.getMetadata(
              'design:paramtypes',
              providerWrapper.metatype,
            );
            if (paramTypes) {
              (details as any).injections = paramTypes.map((t: any) => t ? t.name : 'Unknown');
            }
          }
        }
      }
    });

    // We pass 'tree' (output of explore) because it contains the full detailed structure including providers and injections
    const debugService = app.get(DebugService);
    debugService.setGraph(tree);

    Logger.log('Dependency graph generated and stored in DebugService', 'Bootstrap');
  } catch (e) {
    Logger.error('Failed to generate dependency graph', e, 'Bootstrap');
  }
}

bootstrap();
