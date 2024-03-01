"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replyOrEdit = void 0;
const replyOrEdit = async (ctx, text, extra) => {
    const messageId = ctx.update.callback_query?.message.message_id
        ? ctx.update.callback_query?.message.message_id
        : ctx.session.messageId;
    const chatId = ctx.from.id;
    if (messageId) {
        return await ctx.telegram.editMessageText(chatId, messageId, undefined, { text, parse_mode: 'HTML' }, extra);
    }
    const reply = await ctx.replyWithHTML(text, extra);
    ctx.session.messageId = reply.message_id;
    return reply;
};
exports.replyOrEdit = replyOrEdit;
//# sourceMappingURL=reply-or-edit.js.map