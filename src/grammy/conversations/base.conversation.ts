import { Logger } from '@nestjs/common';
import { MyContext } from '../grammy-context.interface';
import { InlineKeyboard, Keyboard } from 'grammy';
import { SCENES } from '../../constants/scenes.const';

/**
 * Base Conversation Class
 *
 * Provides common utilities for all conversation handlers.
 * Replaces the old AbstractScene class from Telegraf.
 */
export abstract class BaseConversation {
  protected logger = new Logger(this.constructor.name);

  /**
   * Send a scene reply (text + keyboard)
   * Handles both inline keyboards and reply keyboards
   */
  protected async sceneReply(
    ctx: MyContext,
    scene: {
      text?: string | ((...args: any[]) => string);
      navigateText?: string;
      buttons?: any[];
      navigateButtons?: any[][];
    },
  ): Promise<void> {
    // Handle navigate buttons (reply keyboard)
    if (scene.navigateButtons && scene.navigateText) {
      const keyboard = new Keyboard();
      for (const row of scene.navigateButtons) {
        for (const button of row) {
          keyboard.text(button.text);
        }
        keyboard.row();
      }

      await ctx.reply(scene.navigateText, {
        parse_mode: 'HTML',
        reply_markup: keyboard.resized(),
      });
      return;
    }

    // Handle inline buttons
    if (scene.buttons) {
      const keyboard = new InlineKeyboard();
      for (const row of scene.buttons) {
        for (const button of row) {
          if (button.url) {
            keyboard.url(button.text, button.url);
          } else if (button.callback_data) {
            keyboard.text(button.text, button.callback_data);
          }
        }
        keyboard.row();
      }

      const text = typeof scene.text === 'function' ? 'Text not rendered' : scene.text;
      await ctx.reply(text || scene.navigateText, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
      return;
    }

    // Just text, no buttons
    const text = typeof scene.text === 'function' ? 'Text not rendered' : scene.text;
    await ctx.reply(text || scene.navigateText, { parse_mode: 'HTML' });
  }

  /**
   * Get scene configuration by command enum
   */
  protected getScene(sceneKey: string): any {
    return SCENES[sceneKey];
  }
}