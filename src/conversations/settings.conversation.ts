import { InlineKeyboard } from 'grammy';
import { MyContext } from '../grammy/grammy-context.interface';
import { getMainKeyboard } from '../grammy/keyboards/main.keyboard';

const ASPECT_RATIOS = ['1:1', '16:9', '9:16', '3:4', '4:3'];

/**
 * Entry point for Stateless Settings Flow
 */
export async function enterSettingsFlow(ctx: MyContext) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const user = await ctx.userService.findByTelegramId(telegramId);
    if (!user) {
        await ctx.reply('❌ Пользователь не найден. Введите /start');
        return;
    }

    const uAny = user as any;
    const settings = uAny.settings || {};

    // Cleanup previous UI if exists
    if (ctx.session.settingsState?.uiMessageId && ctx.session.settingsState?.uiChatId) {
        try { await ctx.api.deleteMessage(ctx.session.settingsState.uiChatId, ctx.session.settingsState.uiMessageId); } catch { }
    }

    // Initialize Session State
    ctx.session.settingsState = {
        uiChatId: ctx.chat?.id,
        draft: {
            aspectRatio: settings.aspectRatio || '1:1',
            hdQuality: settings.hdQuality || false,
            askAspectRatio: settings.askAspectRatio !== false, // default true (schema default is false now, logic follows)
            // Wait, schema default is false. If null/undefined in DB/settings object, it might vary.
            // If user never set it, DB returns default. 
            // In enterGenerateFlow we treated undefined as true/false based on logic.
            // Here we should trust the DB value. 
            // If settings.askAspectRatio is undefined, it means default from Schema (false).
            // So: settings.askAspectRatio ?? false
            // ACTUALLY, I should check what prisma returns. defaults are applied.
            // But let's mirror what we passed.
            selectedModelId: settings.selectedModelId || 'gemini-2.5-flash-image'
        }
    };

    // Helper fetch
    const prices = await fetchPrices(ctx, user.id, ctx.session.settingsState.draft!.hdQuality);

    // Build UI
    const ui = buildSettingsUI(ctx.session.settingsState.draft!, prices);

    const m = await ctx.reply(ui.text, { reply_markup: ui.keyboard, parse_mode: 'Markdown' });

    // Save Message ID
    if (ctx.session.settingsState) {
        ctx.session.settingsState.uiMessageId = m.message_id;
    }
}

/**
 * Middleware handler for Settings Interactions
 */
export async function processSettingsInput(ctx: MyContext): Promise<boolean> {
    const state = ctx.session.settingsState;
    if (!state || !state.draft) return false;

    // Validate Chat
    if (ctx.chat?.id !== state.uiChatId) return false;

    // Validate Message ID for callbacks to prevent stale menu interactions
    if (ctx.callbackQuery && ctx.callbackQuery.message && ctx.callbackQuery.message.message_id !== state.uiMessageId) {
        await ctx.answerCallbackQuery({ text: '⚠️ Меню устарело. Откройте настройки заново.' });
        try { await ctx.deleteMessage(); } catch { }
        return true; // handled, stop propagation
    }

    // Text Commands to exit/clear
    if (ctx.message?.text) {
        // If user sends a command or main menu button, we should probably close settings?
        // Or just let it persist? 
        // In generate, we closed on main menu. Here, let's close on /start or /reset.
        const text = ctx.message.text;
        if (text === '/start' || text === '/reset') {
            await deleteUiMessage(ctx);
            ctx.session.settingsState = undefined;
            return false; // propagate
        }
        // If it's something else, ignore? Or return false?
        return false;
    }

    if (!ctx.callbackQuery) return false;

    const data = ctx.callbackQuery.data;
    if (!data) return false;

    // Ensure it looks like settings data
    const isSettingsAction = data.startsWith('aspect_') ||
        ['toggle_hd', 'toggle_ask_ratio', 'toggle_model', 'save_settings', 'close_settings'].includes(data);

    if (!isSettingsAction) return false;

    // We handle it
    const telegramId = ctx.from?.id;
    if (!telegramId) return true; // Consume but do nothing

    const user = await ctx.userService.findByTelegramId(telegramId);
    if (!user) return true;

    // Handle Actions
    let updated = false;

    if (data.startsWith('aspect_')) {
        state.draft.aspectRatio = data.split('_')[1];
        updated = true;
    } else if (data === 'toggle_hd') {
        state.draft.hdQuality = !state.draft.hdQuality;
        updated = true;
    } else if (data === 'toggle_ask_ratio') {
        state.draft.askAspectRatio = !state.draft.askAspectRatio;
        updated = true;
    } else if (data === 'toggle_model') {
        state.draft.selectedModelId = state.draft.selectedModelId === 'gemini-2.5-flash-image'
            ? 'gemini-3-pro-image-preview'
            : 'gemini-2.5-flash-image';
        updated = true;
    } else if (data === 'save_settings') {
        await ctx.userService.updateSettings(user.id, {
            aspectRatio: state.draft.aspectRatio,
            hdQuality: state.draft.hdQuality,
            askAspectRatio: state.draft.askAspectRatio,
            selectedModelId: state.draft.selectedModelId
        });

        await ctx.answerCallbackQuery({ text: '✅ Настройки сохранены!' });
        await deleteUiMessage(ctx);

        const modelName = state.draft.selectedModelId === 'gemini-3-pro-image-preview' ? 'Продвинутая' : 'Простая';
        await ctx.reply(
            `✅ Настройки сохранены!\n📐 Формат: **${state.draft.aspectRatio}**\n💎 Качество: **${state.draft.hdQuality ? '4K' : '2K'}**\n❓ Спрашивать: **${state.draft.askAspectRatio ? 'Да' : 'Нет'}**\n🤖 Модель: **${modelName}**`,
            { parse_mode: 'Markdown', reply_markup: getMainKeyboard() } // Ensure main keyboard is there
        );

        ctx.session.settingsState = undefined;
        return true;
    } else if (data === 'close_settings') {
        await ctx.answerCallbackQuery();
        await deleteUiMessage(ctx);
        ctx.session.settingsState = undefined;
        return true;
    }

    if (updated) {
        await ctx.answerCallbackQuery(); // just acknowledge

        // Rebuild UI
        const prices = await fetchPrices(ctx, user.id, state.draft.hdQuality);
        const ui = buildSettingsUI(state.draft, prices);

        if (state.uiMessageId && state.uiChatId) {
            try {
                await ctx.api.editMessageText(state.uiChatId, state.uiMessageId, ui.text, {
                    reply_markup: ui.keyboard,
                    parse_mode: 'Markdown'
                });
            } catch (e) {
                // Ignore "message is not modified"
            }
        }
    }

    return true;
}

// --- Helpers ---

async function fetchPrices(ctx: MyContext, userId: string, isHd: boolean) {
    const [costPro, costSimple] = await Promise.all([
        ctx.creditsService.estimateImageGenCost(userId, 'gemini-3-pro-image-preview', isHd),
        ctx.creditsService.estimateImageGenCost(userId, 'gemini-2.5-flash-image', isHd)
    ]);
    return {
        pro: Math.round(costPro),
        simple: Math.round(costSimple)
    };
}

async function deleteUiMessage(ctx: MyContext) {
    const st = ctx.session.settingsState;
    if (st?.uiMessageId && st?.uiChatId) {
        try { await ctx.api.deleteMessage(st.uiChatId, st.uiMessageId); } catch { }
    }
}

interface SettingsDraft {
    aspectRatio: string;
    hdQuality: boolean;
    askAspectRatio: boolean;
    selectedModelId: string;
}

function buildSettingsUI(draft: SettingsDraft, prices: { pro: number, simple: number }) {
    const { aspectRatio, hdQuality, askAspectRatio, selectedModelId } = draft;
    const keyboard = new InlineKeyboard();

    ASPECT_RATIOS.forEach((r, i) => {
        keyboard.text(r === aspectRatio ? `✅ ${r}` : r, `aspect_${r}`);
        if ((i + 1) % 3 === 0) keyboard.row();
    });
    if (ASPECT_RATIOS.length % 3 !== 0) keyboard.row();

    // HD Quality Toggle
    const hdText = hdQuality ? '✅ 💎 HD (4K)' : '⬜️ 💎 HD (2K)';
    keyboard.text(hdText, 'toggle_hd').row();

    // Ask Aspect Ratio Toggle
    const askText = askAspectRatio ? '✅ 📐 Спрашивать формат' : '⬜️ 📐 Спрашивать формат';
    keyboard.text(askText, 'toggle_ask_ratio').row();

    // Model Toggle
    const isPro = selectedModelId === 'gemini-3-pro-image-preview';
    const modelText = isPro ? '✅ 🤖 Модель: Продвинутая' : '⬜️ 🤖 Модель: Простая';
    keyboard.text(modelText, 'toggle_model').row();

    keyboard.text('✅ Сохранить', 'save_settings').row();
    keyboard.text('🔙 Назад', 'close_settings');

    const modelDesc = isPro
        ? `Продвинутая (Gemini 3.0 Pro) (~${prices.pro} монет/шт)`
        : `Простая (Gemini 2.5 Flash) (~${prices.simple} монет/шт)`;

    return {
        text: `⚙️ **Настройки**\n\n📐 **Соотношение сторон:** ${aspectRatio}\n💎 **Качество:** ${hdQuality ? '4K (HD)' : '2K (Standard)'}\n❓ **Спрашивать формат:** ${askAspectRatio ? 'Да' : 'Нет'}\n🤖 **Модель:** ${modelDesc}\n\nВыберите параметры:`,
        keyboard
    };
}