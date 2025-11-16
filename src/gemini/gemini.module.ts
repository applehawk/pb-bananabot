import { Module } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

/**
 * Gemini AI Module
 *
 * Provides integration with Google Gemini AI for image generation
 */
@Module({
  imports: [ConfigModule, HttpModule],
  providers: [GeminiService],
  exports: [GeminiService],
})
export class GeminiModule {}
