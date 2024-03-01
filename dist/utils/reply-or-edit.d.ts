import { ExtraEditMessageText } from 'telegraf/typings/telegram-types';
import { Context } from '../interfaces/context.interface';
export declare const replyOrEdit: (ctx: Context, text: string, extra: ExtraEditMessageText) => Promise<any>;
