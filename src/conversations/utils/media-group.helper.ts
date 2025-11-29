import { Conversation } from '@grammyjs/conversations';
import { MyContext } from '../../grammy/grammy-context.interface';

/**
 * Handle media_group (album) - collect all photos with same media_group_id
 * Returns: { prompt, fileIds, messageIdsToDelete, nextUpdate?, pendingWait? }
 */
export async function handleMediaGroup(
    ctxMsg: MyContext,
    conversation: Conversation<MyContext>,
    currentPrompt: string
): Promise<{
    prompt: string;
    fileIds: string[];
    messageIdsToDelete: Array<{ chatId: number; messageId: number }>;
    nextUpdate?: any;
    pendingWait?: Promise<MyContext>;
}> {
    let prompt = currentPrompt;
    const fileIds: string[] = [];
    const messageIdsToDelete: Array<{ chatId: number; messageId: number }> = [];

    try {
        const groupId = ctxMsg.message?.media_group_id;
        if (!groupId || !ctxMsg.message) return { prompt, fileIds, messageIdsToDelete };

        // Collect all album messages (including current one)
        const collected: Array<MyContext> = [ctxMsg];

        // Wait for additional photos in the album with a small timeout
        const waitTimeout = 900; // ms
        const pollInterval = 200; // ms
        const start = Date.now();

        let pendingWait: Promise<MyContext> | undefined;

        while (Date.now() - start < waitTimeout) {
            // Wait for ANY update that might be relevant (text, photo, callback)
            // If we get a photo with same group ID -> add it
            // If we get something else -> return it as nextUpdate
            // If timeout -> return pendingWait

            const waitPromise = pendingWait || (conversation.waitFor(['message:text', 'message:photo', 'callback_query:data']) as unknown as Promise<MyContext>);
            pendingWait = waitPromise;

            const nextOrNull = await Promise.race([
                waitPromise.then(c => ({ type: 'update', ctx: c })),
                new Promise<{ type: 'timeout' }>(res => setTimeout(() => res({ type: 'timeout' }), pollInterval)),
            ]);

            if (nextOrNull.type === 'timeout') {
                // Timeout for this poll interval, but we continue waiting until total waitTimeout
                continue;
            }

            // Update won
            const nextCtx = (nextOrNull as any).ctx as MyContext;
            pendingWait = undefined; // Consumed

            console.log('[MediaGroup] Received update. GroupID:', nextCtx.message?.media_group_id, 'Expected:', groupId);

            if (nextCtx.message?.media_group_id === groupId) {
                collected.push(nextCtx);
            } else {
                console.log('[MediaGroup] Different update received, stopping collection.');
                // Different update - stop collecting and return it
                return {
                    prompt: extractPrompt(collected, prompt),
                    fileIds: extractFileIds(collected),
                    messageIdsToDelete: extractMessageIds(collected),
                    nextUpdate: nextCtx
                };
            }
        }

        return {
            prompt: extractPrompt(collected, prompt),
            fileIds: extractFileIds(collected),
            messageIdsToDelete: extractMessageIds(collected),
            pendingWait
        };

    } catch (err) {
        console.error('handleMediaGroup error:', err);
        return { prompt, fileIds, messageIdsToDelete };
    }
}

function extractFileIds(collected: MyContext[]): string[] {
    const ids: string[] = [];
    for (const item of collected) {
        const photos = item.message?.photo;
        if (photos && photos.length > 0) {
            const largest = photos[photos.length - 1];
            if (largest?.file_id) ids.push(largest.file_id);
        }
    }
    return ids;
}

function extractPrompt(collected: MyContext[], current: string): string {
    let p = current;
    for (const item of collected) {
        if (!p && item.message?.caption) {
            p = item.message.caption.trim();
        }
    }
    return p;
}

function extractMessageIds(collected: MyContext[]): Array<{ chatId: number; messageId: number }> {
    const ids: Array<{ chatId: number; messageId: number }> = [];
    for (const item of collected) {
        if (item.chat && item.message) {
            ids.push({ chatId: item.chat.id, messageId: item.message.message_id });
        }
    }
    return ids;
}
