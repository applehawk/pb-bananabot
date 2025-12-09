import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { GenerationService } from '../../generation/generation.service';
import { BotService } from '../../grammy/bot.service';
import { InputFile } from 'grammy';

export interface GenerationJobData {
    userId: string;
    generationId: string; // Added
    chatId: number;
    prompt: string;
    mode: 'TEXT_TO_IMAGE' | 'IMAGE_TO_IMAGE';
    inputImages?: Array<{ buffer: Buffer; mimeType: string; fileId?: string }>;
    aspectRatio: string;
    username?: string;
    modelName?: string;
}

@Processor('generation', { concurrency: 5 })
export class GenerationProcessor extends WorkerHost {
    private readonly logger = new Logger(GenerationProcessor.name);

    constructor(
        private readonly generationService: GenerationService,
        private readonly botService: BotService,
    ) {
        super();
    }

    async process(job: Job<GenerationJobData, any, string>): Promise<any> {
        const { userId, generationId, chatId, prompt, mode, inputImages, aspectRatio } = job.data;
        this.logger.log(`Processing generation job ${job.id} (GenID: ${generationId}) for user ${userId}`);

        try {
            // Notify start? Maybe not needed if we queue silently, but user expects feedback.
            // We already told them "Queued".

            let result: any;
            if (mode === 'TEXT_TO_IMAGE') {
                result = await this.generationService.generateTextToImage({
                    userId,
                    generationId,
                    prompt,
                    aspectRatio,
                });
            } else {
                // Hydrate buffers if they were serialized (BullMQ handles JSON, so Buffer might be object)
                // Actually, we need to be careful with Buffer serialization.
                // It's better passing base64 or ensuring Buffer is reconstructed.
                const hydratedImages = inputImages?.map((img: any) => ({
                    ...img,
                    buffer: Buffer.isBuffer(img.buffer) ? img.buffer : Buffer.from(img.buffer.data || img.buffer),
                }));

                result = await this.generationService.generateImageToImage({
                    userId,
                    generationId,
                    prompt,
                    inputImages: hydratedImages,
                    aspectRatio,
                });
            }

            // Handle Result
            const creditsUsed = Number(result.creditsUsed || 0);
            const processingTime = Number(result.processingTime || 0);

            const caption =
                `🎨 ${prompt.length > 50 ? prompt.slice(0, 50) + '...' : prompt}\n\n` +
                `💎 Использовано: ${creditsUsed.toFixed(2)} монет\n` +
                `⏱ ${(processingTime / 1000).toFixed(1)}с`;

            // Send Result
            if (result.imageUrl) {
                await this.botService.sendPhoto(chatId, result.imageUrl, caption);
            } else if (result.imageData || result.imageDataBase64) {
                const imageContent = result.imageData || result.imageDataBase64;
                const buffer = Buffer.isBuffer(imageContent)
                    ? imageContent
                    : Buffer.from(imageContent, 'base64');
                await this.botService.sendPhoto(chatId, new InputFile(buffer), caption);
            } else {
                await this.botService.sendMessage(chatId, '✅ Генерация завершена, но результат не получен.');
            }

        } catch (error) {
            this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
            await this.botService.sendMessage(chatId, `❌ Ошибка генерации: ${error.message || 'Неизвестная ошибка'}`);
            throw error;
        }
    }
}
