import { BotContext } from '../shared/context';

export async function getSessionKey(
  ctx: BotContext,
): Promise<string | undefined> {
  const fromId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  if (fromId == null || chatId == null) {
    return undefined;
  }
  return createSessionKey(fromId, chatId);
}

export function createSessionKey(fromId: number, chatId: number): string {
  return `${fromId}:${chatId}`;
}
