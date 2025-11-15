import { Injectable, Logger } from '@nestjs/common';
import { Bot, InputFile } from 'grammy';

/**
 * Telegram Storage Service
 * Uses Telegram as free cloud storage via file_id
 */
@Injectable()
export class TelegramStorageService {
  private readonly logger = new Logger(TelegramStorageService.name);
  private readonly storageChatId: string; // Private channel for storage

  constructor() {
    // Can use environment variable for dedicated storage channel
    // or use bot's own saved messages
    this.storageChatId = process.env.TELEGRAM_STORAGE_CHAT_ID || null;
  }

  /**
   * Upload image to Telegram and get file_id
   * Telegram keeps files forever and they're accessible via file_id
   */
  async uploadImage(
    bot: Bot,
    buffer: Buffer,
  ): Promise<{ fileId: string; fileUniqueId: string }> {
    try {
      // Create InputFile from buffer
      const inputFile = new InputFile(buffer, 'generation.jpg');

      let message;

      if (this.storageChatId) {
        // Upload to dedicated storage channel
        message = await bot.api.sendPhoto(this.storageChatId, inputFile);
      } else {
        // Fallback: upload to bot's saved messages (can use admin chat)
        // This is a temporary solution - ideally create a private channel
        this.logger.warn(
          'No storage chat configured, file_id will be temporary',
        );
        return { fileId: null, fileUniqueId: null };
      }

      const photo = message.photo[message.photo.length - 1]; // Largest size

      this.logger.log(`Image uploaded to Telegram: ${photo.file_id}`);

      return {
        fileId: photo.file_id,
        fileUniqueId: photo.file_unique_id,
      };
    } catch (error) {
      this.logger.error(`Failed to upload to Telegram: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if Telegram storage is configured
   */
  isConfigured(): boolean {
    return !!this.storageChatId;
  }

  /**
   * Get storage info
   */
  getInfo() {
    return {
      type: 'telegram',
      configured: this.isConfigured(),
      chatId: this.storageChatId,
    };
  }
}
