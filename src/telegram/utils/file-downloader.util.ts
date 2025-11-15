import { Injectable, Logger } from '@nestjs/common';
import { Bot } from 'grammy';
import axios from 'axios';

/**
 * Utility for downloading files from Telegram
 */
@Injectable()
export class TelegramFileDownloader {
  private readonly logger = new Logger(TelegramFileDownloader.name);

  /**
   * Download file from Telegram using getFile API
   * https://core.telegram.org/bots/api#getfile
   */
  async downloadFile(bot: Bot, fileId: string): Promise<Buffer> {
    try {
      // 1. Get file info from Telegram
      const file = await bot.api.getFile(fileId);

      if (!file.file_path) {
        throw new Error('File path not available');
      }

      // 2. Construct download URL
      const token = bot.token;
      const downloadUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

      this.logger.debug(`Downloading file from: ${downloadUrl}`);

      // 3. Download file
      const response = await axios.get(downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30 seconds
      });

      const buffer = Buffer.from(response.data);

      this.logger.log(
        `File downloaded: ${fileId}, size: ${buffer.length} bytes`,
      );

      return buffer;
    } catch (error) {
      this.logger.error(`Failed to download file ${fileId}: ${error.message}`);
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

  /**
   * Download photo from Telegram
   * Photos come as array of PhotoSize, we take the largest one
   */
  async downloadPhoto(bot: Bot, photoSizes: any[]): Promise<Buffer> {
    if (!photoSizes || photoSizes.length === 0) {
      throw new Error('No photo sizes available');
    }

    // Get the largest photo
    const largestPhoto = photoSizes.reduce((prev, current) => {
      return (prev.file_size || 0) > (current.file_size || 0) ? prev : current;
    });

    this.logger.debug(`Downloading largest photo: ${largestPhoto.file_id}`);

    return this.downloadFile(bot, largestPhoto.file_id);
  }

  /**
   * Download multiple photos (for multi-image generation)
   */
  async downloadPhotos(bot: Bot, photoGroups: any[][]): Promise<Buffer[]> {
    const downloadPromises = photoGroups.map((photos) =>
      this.downloadPhoto(bot, photos),
    );
    return Promise.all(downloadPromises);
  }

  /**
   * Get file info without downloading
   */
  async getFileInfo(bot: Bot, fileId: string) {
    const file = await bot.api.getFile(fileId);
    return {
      fileId: file.file_id,
      fileUniqueId: file.file_unique_id,
      fileSize: file.file_size,
      filePath: file.file_path,
    };
  }

  /**
   * Check file size limit (20MB for photos)
   */
  async checkFileSize(
    bot: Bot,
    fileId: string,
    maxSizeMB: number = 20,
  ): Promise<boolean> {
    const file = await bot.api.getFile(fileId);
    const fileSizeMB = (file.file_size || 0) / (1024 * 1024);

    if (fileSizeMB > maxSizeMB) {
      this.logger.warn(
        `File ${fileId} exceeds size limit: ${fileSizeMB}MB > ${maxSizeMB}MB`,
      );
      return false;
    }

    return true;
  }
}
