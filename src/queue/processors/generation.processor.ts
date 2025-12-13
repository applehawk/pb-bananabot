import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { GenerationService } from '../../generation/generation.service';
import { BotService } from '../../grammy/bot.service';
import { UserService } from '../../user/user.service';
import { PaymentService } from '../../payment/payment.service';
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
        private readonly paymentService: PaymentService,
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

            // Escape HTML characters to prevent breaking the message
            const safePrompt = prompt
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');

            // 1. Prepare Base Prompt (Original)
            // If we have enhanced prompt, show less of original to save space
            const hasEnhanced = result.enhancedPrompt && result.enhancedPrompt !== prompt;
            const maxPromptLength = hasEnhanced ? 200 : 850; // Reserve space if enhanced exists

            const displayPrompt = safePrompt.length > maxPromptLength
                ? safePrompt.slice(0, maxPromptLength) + '...'
                : safePrompt;

            let caption = `🎨 ${displayPrompt}\n\n`;

            // 2. Prepare Stats String (to calculate remaining space)
            const stats = `💎 Использовано: ${creditsUsed.toFixed(2)} монет\n` +
                `💳 Баланс: ${userBalance} монет\n` +
                `⏱ ${(processingTime / 1000).toFixed(1)}с`;

            // 3. Add Enhanced Prompt (safely truncated)
            if (hasEnhanced) {
                const safeEnhanced = result.enhancedPrompt
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');

                // Calculate available space
                // Limit: 1024
                // Used so far: caption.length (original prompt + header)
                // Overhead for tags: "✨ <b>...</b>\n<i></i>\n\n" -> approx 50 chars
                // NOTE: We do NOT reserve space for stats anymore as they are low priority.
                const currentLen = caption.length;
                const maxEnhancedLen = 1024 - currentLen - 50;

                // Ensure we have at least SOME space
                if (maxEnhancedLen > 20) {
                    const displayEnhanced = safeEnhanced.length > maxEnhancedLen
                        ? safeEnhanced.slice(0, maxEnhancedLen) + '...'
                        : safeEnhanced;

                    caption += `✨ <b>Улучшенный промпт:</b>\n<i>${displayEnhanced}</i>\n\n`;
                }
            }

            // 4. Append Stats (If space permits)
            if (caption.length + stats.length <= 1024) {
                caption += stats;
            } else {
                // Try minimal stats if full stats don't fit
                const shortStats = `💎 ${creditsUsed.toFixed(2)} | 💳 ${userBalance}`;
                if (caption.length + shortStats.length <= 1024) {
                    caption += shortStats;
                }
            }

            // Send Result with Variation Button
            const keyboard = {
                inline_keyboard: [
                    [{ text: '🔄 Вариация', callback_data: `regenerate_${generationId}` }]
                ]
            };

            if (result.imageUrl) {
                // Note: sendPhoto in BotService takes (chatId, photo, caption, reply_markup)
                await this.botService.sendPhoto(chatId, result.imageUrl, caption, keyboard);
                // Send as document (file)
                await this.botService.sendDocument(chatId, result.imageUrl, '📂 Оригинал высокого качества');
            } else if (result.imageData || result.imageDataBase64) {
                const imageContent = result.imageData || result.imageDataBase64;
                const buffer = Buffer.isBuffer(imageContent)
                    ? imageContent
                    : Buffer.from(imageContent, 'base64');

                await this.botService.sendPhoto(chatId, new InputFile(buffer), caption, keyboard);

                // Send as document (file)
                // Try to give it a name
                const filename = `generation_${generationId}.png`;
                await this.botService.sendDocument(chatId, new InputFile(buffer, filename), '📂 Оригинал высокого качества');
            } else {
                // Note: sendMessage in BotService now takes (chatId, text, options)
                await this.botService.sendMessage(chatId, '✅ Генерация завершена, но результат не получен.', { reply_markup: keyboard });
            }

            // Notify Admins
            try {
                const imageContent = result.imageData || result.imageDataBase64;
                const imageForAdmin = result.imageUrl
                    ? result.imageUrl
                    : (imageContent
                        ? (Buffer.isBuffer(imageContent)
                            ? new InputFile(imageContent)
                            : new InputFile(Buffer.from(imageContent, 'base64')))
                        : null);

                if (imageForAdmin) {
                    // We need username, prompt.
                    // username is in job.data? Yes.
                    // prompt is in job.data.
                    const username = job.data.username || (user ? user.username : 'Unknown');
                    await this.botService.sendAdminGenerationNotification(
                        username,
                        prompt,
                        imageForAdmin,
                        generationId,
                        result.enhancedPrompt
                    );
                }
            } catch (e) {
                this.logger.error(`Failed to notify admins regarding generation ${generationId}`, e);
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
            } else if (error.message && error.message.includes('Insufficient credits')) {
                // Parse amounts from "Insufficient credits. Required: X, Available: Y"
                const matches = error.message.match(/Required: ([\d.]+), Available: ([\d.]+)/);
                let msg = '😔 Недостаточно средств для генерации.';

                if (matches && matches.length >= 3) {
                    const required = matches[1];
                    const available = matches[2];
                    msg += `\n\n💎 Требуется: ${required}\n💳 Доступно: ${available}`;
                }

                // Tripwire Logic check
                let keyboard: any = {
                    inline_keyboard: [
                        [{ text: '💳 Пополнить баланс', callback_data: 'buy_credits' }]
                    ]
                };

                try {
                    const settings: any = await this.userService.getSystemConfig();
                    const tripwireId = settings?.tripwirePackageId;

                    if (tripwireId) {
                        const user = await this.userService.findById(userId);
                        const settings = await this.userService.getSystemConfig();
                        const freeCreditsAmount = settings.freeCreditsAmount || 3;

                        // Tripwire logic: Offer if they have consumed their free allocation
                        const isNewUser = (user?.freeCreditsUsed || 0) >= freeCreditsAmount;

                        if (isNewUser) {
                            const pkg = await this.paymentService.getCreditPackage(tripwireId);
                            if (pkg && pkg.active) {
                                // Generate Payment URL
                                const url = this.paymentService.generateInitPayUrl(Number(userId), chatId, pkg.id);
                                msg += `\n\n🚀 <b>Спецпредложение для новичков!</b>\n` +
                                    `<b>${pkg.name}</b>: ${pkg.credits} монет за <b>${pkg.priceYooMoney || pkg.price}₽</b>`;

                                keyboard = {
                                    inline_keyboard: [
                                        [{ text: `🚀 Купить старт за ${pkg.priceYooMoney || pkg.price}₽`, url: url }],
                                        [{ text: '🔙 Отмена', callback_data: 'cancel_generation' }]
                                    ]
                                };
                            }
                        }
                    }
                } catch (e) {
                    // ignore
                }

                await this.botService.sendMessage(chatId, msg, { reply_markup: keyboard });
            } else {
                await this.botService.sendMessage(chatId, `❌ Ошибка генерации: ${error.message || 'Неизвестная ошибка'}`);
            }
            throw error;
        }
    }
}
