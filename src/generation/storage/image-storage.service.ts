import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as sharp from 'sharp';

@Injectable()
export class ImageStorageService {
  private readonly logger = new Logger(ImageStorageService.name);
  private s3Client: S3Client;
  private bucket: string;
  private publicUrl: string;
  private storageType: string;

  constructor(private readonly config: ConfigService) {
    this.storageType = this.config.get<string>('storage.type');

    if (this.storageType === 's3') {
      this.s3Client = new S3Client({
        region: this.config.get('storage.aws.region'),
        credentials: {
          accessKeyId: this.config.get('storage.aws.accessKeyId'),
          secretAccessKey: this.config.get('storage.aws.secretAccessKey'),
        },
      });
      this.bucket = this.config.get('storage.aws.bucket');
      this.publicUrl = this.config.get('storage.aws.publicUrl');
    } else if (this.storageType === 'r2') {
      // Cloudflare R2 is S3-compatible
      const accountId = this.config.get('storage.r2.accountId');
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: this.config.get('storage.r2.accessKeyId'),
          secretAccessKey: this.config.get('storage.r2.secretAccessKey'),
        },
      });
      this.bucket = this.config.get('storage.r2.bucketName');
      this.publicUrl = this.config.get('storage.r2.publicUrl');
    }

    this.logger.log(`Image storage initialized: ${this.storageType}`);
  }

  /**
   * Upload image to S3/R2
   */
  async uploadImage(buffer: Buffer, generationId: string): Promise<string> {
    try {
      const quality = this.config.get<number>('image.quality', 90);

      // Optimize image
      const optimized = await sharp(buffer)
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();

      const key = `generations/${generationId}.jpg`;

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: optimized,
        ContentType: 'image/jpeg',
        ACL: 'public-read',
      });

      await this.s3Client.send(command);

      const url = `${this.publicUrl}/${key}`;
      this.logger.log(`Image uploaded: ${url}`);

      return url;
    } catch (error) {
      this.logger.error(
        `Failed to upload image: ${error.message}`,
        error.stack,
      );
      throw new Error(`Image upload failed: ${error.message}`);
    }
  }

  /**
   * Create and upload thumbnail
   */
  async createThumbnail(buffer: Buffer, generationId: string): Promise<string> {
    try {
      const thumbnailSize = this.config.get<number>('image.thumbnailSize', 300);

      const thumbnail = await sharp(buffer)
        .resize(thumbnailSize, thumbnailSize, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({ quality: 80 })
        .toBuffer();

      const key = `thumbnails/${generationId}.jpg`;

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: thumbnail,
        ContentType: 'image/jpeg',
        ACL: 'public-read',
      });

      await this.s3Client.send(command);

      const url = `${this.publicUrl}/${key}`;
      this.logger.log(`Thumbnail uploaded: ${url}`);

      return url;
    } catch (error) {
      this.logger.error(
        `Failed to create thumbnail: ${error.message}`,
        error.stack,
      );
      // Non-critical error, return null
      return null;
    }
  }

  /**
   * Upload multiple images (for batch generation)
   */
  async uploadBatch(images: Buffer[], generationId: string): Promise<string[]> {
    const uploadPromises = images.map((buffer, index) => {
      const imageId = `${generationId}_${index + 1}`;
      return this.uploadImage(buffer, imageId);
    });

    return Promise.all(uploadPromises);
  }

  /**
   * Check if storage is configured
   */
  isConfigured(): boolean {
    return !!this.s3Client && !!this.bucket;
  }

  /**
   * Get storage info
   */
  getStorageInfo() {
    return {
      type: this.storageType,
      bucket: this.bucket,
      configured: this.isConfigured(),
    };
  }
}
