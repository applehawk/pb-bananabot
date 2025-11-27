import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface GenerateImageParams {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  numberOfImages?: number;
  inputImages?: Array<{ data: Buffer; mimeType: string }>;
  modelName?: string;
}

export interface GenerationResult {
  images: Array<{
    data: string; // base64
    mimeType: string;
  }>;
  prompt: string;
  enhancedPrompt?: string;
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private genAI: GoogleGenerativeAI;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('gemini.apiKey');

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.logger.log('Gemini AI initialized');
  }

  /**
   * Get model instance for a specific model name
   */
  private getModel(modelName?: string): any {
    const model = modelName || this.config.get<string>('gemini.model');
    return this.genAI.getGenerativeModel({ model });
  }

  /**
   * Enhance prompt with AI
   */
  async enhancePrompt(prompt: string, modelName?: string): Promise<string> {
    try {
      const enhancementPrompt =
        'You are an expert at writing prompts for AI image generation.\n' +
        'Take this user prompt and enhance it to create a detailed, high-quality image generation prompt.\n' +
        'Add details about style, lighting, composition, and quality while keeping the original intent.\n' +
        'User prompt: "' +
        prompt +
        '"\n\n' +
        'Return ONLY the enhanced prompt, nothing else.';

      const model = this.getModel(modelName);
      const result = await model.generateContent(enhancementPrompt);
      const response = await result.response;
      const enhanced = response.text().trim();

      this.logger.debug('Enhanced prompt: ' + enhanced);
      return enhanced;
    } catch (error) {
      this.logger.warn(
        'Failed to enhance prompt, using original: ' + error.message,
      );
      return prompt;
    }
  }

  /**
   * Generate image from text (Text-to-Image)
   */
  async generateFromText(
    params: GenerateImageParams,
  ): Promise<GenerationResult> {
    const {
      prompt,
      negativePrompt,
      aspectRatio = '1:1',
      numberOfImages = 1,
      modelName,
    } = params;

    const shortPrompt =
      prompt.length > 50 ? prompt.slice(0, 50) + '...' : prompt;
    this.logger.log(
      'Generating ' + numberOfImages + ' image(s) for prompt: ' + shortPrompt,
    );

    try {
      // Build full prompt with negative prompt
      let fullPrompt = prompt;
      if (negativePrompt) {
        fullPrompt += '\n\nNegative prompt (avoid these): ' + negativePrompt;
      }

      const model = this.getModel(modelName);
      const result = await model.generateContent({
        contents: [
          {
            parts: [{ text: fullPrompt }],
          },
        ],
        generationConfig: {
          responseModalities: ['Image'],
          imageConfig: {
            aspectRatio: aspectRatio,
          },
        },
      });

      const response = await result.response;
      const images: Array<{ data: string; mimeType: string }> = [];

      // Extract images from response parts
      if (response.candidates && response.candidates[0]) {
        const parts = response.candidates[0].content?.parts || [];

        for (const part of parts) {
          if (part.inlineData) {
            images.push({
              data: part.inlineData.data, // Already base64
              mimeType: part.inlineData.mimeType || 'image/png',
            });
          }
        }
      }

      if (images.length === 0) {
        throw new Error('No images generated in response');
      }

      return {
        images,
        prompt,
        enhancedPrompt: fullPrompt,
      };
    } catch (error) {
      this.logger.error(
        'Image generation failed: ' + error.message,
        error.stack,
      );
      throw new Error('Failed to generate image: ' + error.message);
    }
  }

  /**
   * Generate image from image + text (Image-to-Image)
   */
  async generateFromImage(
    params: GenerateImageParams,
  ): Promise<GenerationResult> {
    const { prompt, inputImages = [], aspectRatio = '1:1', modelName } = params;

    if (inputImages.length === 0) {
      throw new Error(
        'At least one input image is required for image-to-image generation',
      );
    }

    this.logger.log(
      'Generating image-to-image with ' + inputImages.length + ' input(s)',
    );

    try {
      const contents: any[] = [{ text: prompt }];

      // Add input images
      for (const img of inputImages) {
        contents.push({
          inlineData: {
            mimeType: img.mimeType,
            data: img.data.toString('base64'),
          },
        });
      }

      const model = this.getModel(modelName);
      const result = await model.generateContent({
        contents: [
          {
            parts: contents,
          },
        ],
        generationConfig: {
          responseModalities: ['Image'],
          imageConfig: {
            aspectRatio: aspectRatio,
          },
        },
      });

      const response = await result.response;
      const images: Array<{ data: string; mimeType: string }> = [];

      // Extract images from response parts
      if (response.candidates && response.candidates[0]) {
        const parts = response.candidates[0].content?.parts || [];

        for (const part of parts) {
          if (part.inlineData) {
            images.push({
              data: part.inlineData.data,
              mimeType: part.inlineData.mimeType || 'image/png',
            });
          }
        }
      }

      if (images.length === 0) {
        throw new Error('No images generated in response');
      }

      return {
        images,
        prompt,
      };
    } catch (error) {
      this.logger.error(
        'Image-to-image generation failed: ' + error.message,
        error.stack,
      );
      throw new Error('Failed to generate image: ' + error.message);
    }
  }

  /**
   * Generate multiple images (batch)
   */
  async generateBatch(params: GenerateImageParams): Promise<GenerationResult> {
    const { numberOfImages = 4 } = params;
    const results: GenerationResult[] = [];

    this.logger.log('Generating batch of ' + numberOfImages + ' images');

    // Generate images sequentially
    for (let i = 0; i < numberOfImages; i++) {
      try {
        const result = params.inputImages?.length
          ? await this.generateFromImage({ ...params, numberOfImages: 1 })
          : await this.generateFromText({ ...params, numberOfImages: 1 });

        results.push(result);
      } catch (error) {
        this.logger.error(
          'Batch generation ' +
          (i + 1) +
          '/' +
          numberOfImages +
          ' failed: ' +
          error.message,
        );
      }
    }

    if (results.length === 0) {
      throw new Error('All batch generations failed');
    }

    // Combine all results
    return {
      images: results.flatMap((r) => r.images),
      prompt: params.prompt,
      enhancedPrompt: results[0]?.enhancedPrompt,
    };
  }

  /**
   * Validate image generation capability
   */
  async healthCheck(): Promise<boolean> {
    try {
      const model = this.getModel();
      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Test prompt for health check' }],
          },
        ],
      });

      return !!result;
    } catch (error) {
      this.logger.error('Gemini health check failed: ' + error.message);
      return false;
    }
  }
}
