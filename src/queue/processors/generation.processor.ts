import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { GenerationService } from '../../generation/generation.service';
import { BotService } from '../../grammy/bot.service';
import { UserService } from '../../user/user.service';
import { InputFile } from 'grammy';

export interface GenerationJobData {
    userId: string;
    generationId: string;
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
        private readonly userService: UserService,
    ) {
        super();
    }

    async process(job: Job<GenerationJobData, any, string>): Promise<any> {
        const { userId, generationId, chatId, prompt, mode, inputImages, aspectRatio } = job.data;
        this.logger.log(`Processing generation job ${job.id} (GenID: ${generationId}) for user ${userId}`);

        try {
            let result: any;
            if (mode === 'TEXT_TO_IMAGE') {
                result = await this.generationService.generateTextToImage({
                    userId,
                    generationId,
                    prompt,
                    aspectRatio,
                });
            } else {
                // Hydrate buffers if they were serialized
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

            // Get updated user balance
            const user = await this.userService.findById(userId);
            const userBalance = user ? Number(user.credits).toFixed(2) : '---';

            // Handle Result
            const creditsUsed = Number(result.creditsUsed || 0);
            const processingTime = Number(result.processingTime || 0);

            const caption =
                `🎨 ${prompt.length > 50 ? prompt.slice(0, 50) + '...' : prompt}\n\n` +
                `💎 Использовано: ${creditsUsed.toFixed(2)} монет\n` +
                `💳 Баланс: ${userBalance} монет\n` +
                `⏱ ${(processingTime / 1000).toFixed(1)}с`;

            // Send Result with Variation Button
            const keyboard = {
                inline_keyboard: [
                    [{ text: '🔄 Вариация', callback_data: `regenerate_${generationId}` }]
                ]
            };

            if (result.imageUrl) {
                // Note: sendPhoto in BotService takes (chatId, photo, caption, reply_markup)
                await this.botService.sendPhoto(chatId, result.imageUrl, caption, keyboard);
            } else if (result.imageData || result.imageDataBase64) {
                const imageContent = result.imageData || result.imageDataBase64;
                const buffer = Buffer.isBuffer(imageContent)
                    ? imageContent
                    : Buffer.from(imageContent, 'base64');
                await this.botService.sendPhoto(chatId, new InputFile(buffer), caption, keyboard);
            } else {
                // Note: sendMessage in BotService now takes (chatId, text, options)
                await this.botService.sendMessage(chatId, '✅ Генерация завершена, но результат не получен.', { reply_markup: keyboard });
            }

        } catch (error) {
            this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);

            // Creative error handling as requested
            const isGeminiError = error.message && (
                error.message.includes('Failed to generate image') ||
                error.message.includes('No images generated') ||
                error.message.includes('SAFETY')
            );

            if (isGeminiError) {
                await this.botService.sendMessage(chatId, 'Упс! Ваше изображение не удалось создать. Попробуйте еще раз, уверен, у вас получится! 🥯');
            } else {
                await this.botService.sendMessage(chatId, `❌ Ошибка генерации: ${error.message || 'Неизвестная ошибка'}`);
            }
            throw error;
        }
    }
}
