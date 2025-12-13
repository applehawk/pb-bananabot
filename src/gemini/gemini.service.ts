import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { lastValueFrom } from 'rxjs';

export interface GenerateImageParams {
  prompt: string;
  // negativePrompt removed
  aspectRatio?: string;
  numberOfImages?: number;
  inputImages?: Array<{ data: Buffer; mimeType: string }>;
  modelName?: string;
}

export interface GenerateVideoParams {
  prompt: string;
  // negativePrompt removed
  inputImage?: { data: Buffer; mimeType: string };
  aspectRatio?: '16:9' | '9:16';
  durationSeconds?: '4' | '8';
  modelName?: string;
}

export interface VideoGenerationResult {
  videoData: Buffer;
  mimeType: string;
  prompt: string;
  modelName: string;
}

export interface GenerationResult {
  images: Array<{
    data: string; // base64
    mimeType: string;
  }>;
  prompt: string;
  enhancedPrompt?: string;
}

export enum VeoModels {
  VEO_3_1 = 'veo-3.1-generate-preview',
  VEO_3_1_FAST = 'veo-3.1-fast-generate-preview', // Assumed, verified via best effort pattern
  VEO_3 = 'veo-3-generate-preview', // Assumed
  VEO_3_FAST = 'veo-3-fast-generate-preview', // Assumed
  VEO_2 = 'veo-2-generate-preview', // Assumed, mostly for legacy support if needed
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private genAI: GoogleGenerativeAI;

  constructor(
    private readonly config: ConfigService,
    private readonly httpService: HttpService,
  ) {
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
  async enhancePrompt(
    prompt: string,
    instruction?: string,
    modelName: string = 'gemini-2.5-flash',
  ): Promise<string> {
    try {
      const defaultInstruction =
        'You are an expert at writing prompts for AI image generation.\n' +
        'Take this user prompt and enhance it to create a detailed, high-quality image generation prompt.\n' +
        'Add details about style, lighting, composition, and quality while keeping the original intent.\n' +
        'Return ONLY the enhanced prompt, nothing else.';

      const systemInstruction = instruction || defaultInstruction;

      const enhancementPrompt =
        systemInstruction + '\n\nUser prompt: "' + prompt + '"';

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
      // negativePrompt removed
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
      // Build full prompt
      const fullPrompt = prompt;

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

  // ===========================================================================
  // Video Generation (Veo)
  // ===========================================================================

  /**
   * Generate video using Veo models via REST API
   */
  async generateVideo(
    params: GenerateVideoParams,
  ): Promise<VideoGenerationResult> {
    const {
      prompt,
      // negativePrompt removed
      inputImage,
      aspectRatio = '16:9',
      modelName = VeoModels.VEO_3_1,
      durationSeconds = '8',
    } = params;

    this.logger.log(
      `Starting video generation with model ${modelName}. Prompt: ${prompt.slice(0, 50)}...`,
    );

    const apiKey = this.config.get<string>('gemini.apiKey');
    const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

    // 1. Prepare request body
    const requestBody: any = {
      instances: [
        {
          prompt: prompt,
        },
      ],
      parameters: {
        aspectRatio: aspectRatio,
        durationSeconds: durationSeconds,
      },
    };

    // Negative prompt logic removed

    if (inputImage) {
      requestBody.instances[0].image = {
        imageBytes: inputImage.data.toString('base64'), // Ensure base64
        mimeType: inputImage.mimeType,
      };
    }

    try {
      // 2. Start Long Running Operation
      const url = `${baseUrl}/models/${modelName}:predictLongRunning?key=${apiKey}`;
      const startResponse = await lastValueFrom(
        this.httpService.post(url, requestBody, {
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const operationName = startResponse.data.name; // e.g. "projects/.../operations/..."
      this.logger.log(`Video generation started. Operation: ${operationName}`);

      // 3. Poll for completion
      const videoUri = await this.pollVideoOperation(
        operationName,
        apiKey,
        baseUrl,
      );

      // 4. Download video
      this.logger.log(`Downloading video from: ${videoUri}`);
      const videoBuffer = await this.downloadVideo(videoUri, apiKey);

      return {
        videoData: videoBuffer,
        mimeType: 'video/mp4',
        modelName,
        prompt,
      };
    } catch (error) {
      this.logger.error(
        'Video generation failed: ' + (error.response?.data?.error?.message || error.message),
        error.stack,
      );
      throw new Error(
        'Failed to generate video: ' + (error.response?.data?.error?.message || error.message),
      );
    }
  }

  private async pollVideoOperation(
    operationName: string,
    apiKey: string,
    baseUrl: string,
  ): Promise<string> {
    const pollUrl = `${baseUrl}/${operationName}?key=${apiKey}`;
    const maxRetries = 60; // 10 minutes (60 * 10s)
    let attempts = 0;

    while (attempts < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10s
      attempts++;

      try {
        const response = await lastValueFrom(this.httpService.get(pollUrl));
        const data = response.data;

        if (data.done) {
          if (data.error) {
            throw new Error(data.error.message || 'Operation failed with error');
          }

          // Extract video URI
          // Structure: response.generateVideoResponse.generatedSamples[0].video.uri
          const uri =
            data.response?.generateVideoResponse?.generatedSamples?.[0]?.video
              ?.uri;

          if (!uri) {
            throw new Error('Video URI not found in completed response');
          }

          return uri;
        }

        this.logger.log(`Polling video... Attempt ${attempts}/${maxRetries}`);
      } catch (error) {
        // If it's a transient error, maybe continue? For now, throw.
        // But if headers/auth are wrong, it will fail repeatedly.
        if (error.response?.status === 404) {
          // Operation might need a moment to propagate? unlikely for polling URL returned by API.
          throw error;
        }
        // If error is just "not ready" logic check above covers it (done=false)
        // If network error, maybe log and continue?
        this.logger.warn(`Polling error: ${error.message}`);
        if (attempts > 5 && error.response?.status >= 400) throw error; // Fail fast on consistent errors
      }
    }

    throw new Error('Video generation timed out');
  }

  private async downloadVideo(uri: string, apiKey: string): Promise<Buffer> {
    // Download requires API key header usually, or just authenticated access.
    // The docs say: curl -H "x-goog-api-key: $GEMINI_API_KEY" "${video_uri}"
    try {
      const response = await lastValueFrom(
        this.httpService.get(uri, {
          headers: {
            'x-goog-api-key': apiKey,
          },
          responseType: 'arraybuffer',
        }),
      );
      return Buffer.from(response.data);
    } catch (error) {
      this.logger.error(`Failed to download video: ${error.message}`);
      throw error;
    }
  }
}
