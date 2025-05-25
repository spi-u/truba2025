import { BotContext } from '../shared/context';
import { middlewareFn } from '../shared/types';
import { logger } from '../utils/logger';

/**
 * Middleware for logging bot interactions
 */
export function logMiddleware(): middlewareFn<BotContext> {
  return async function (ctx, next) {
    try {
      // Build log message from various context components
      const message = buildLogMessage(ctx);

      // Log the message if it's not empty
      if (message) {
        logger.info(message);
      }

      // Continue to next middleware
      await next();
    } catch (error) {
      // Log the error but allow the request to continue
      logger.error(
        `Error in log middleware: ${error instanceof Error ? error.message : String(error)}`,
      );
      await next();
    }
  };
}

/**
 * Builds a comprehensive log message from various parts of the context
 */
function buildLogMessage(ctx: BotContext): string {
  const messageParts: string[] = [];

  // Add user information if available
  const userInfo = getUserInfo(ctx);
  if (userInfo) messageParts.push(userInfo);

  // Add scene information if available
  const sceneInfo = getSceneInfo(ctx);
  if (sceneInfo) messageParts.push(sceneInfo);

  // Add interaction information if available
  const interactionInfo = getInteractionInfo(ctx);
  if (interactionInfo) messageParts.push(interactionInfo);

  return messageParts.join(' ');
}

/**
 * Extracts user information from context
 */
function getUserInfo(ctx: BotContext): string {
  if (!ctx.user) return '';

  const { tgFirstName, tgLastName, tgUsername } = ctx.user;
  return `${tgFirstName || ''} ${tgLastName || ''} (${tgUsername || 'unknown'}) -`;
}

/**
 * Extracts scene information from context
 */
function getSceneInfo(ctx: BotContext): string {
  if (!ctx.scene?.current) return '';

  return `(${ctx.scene.current.id})`;
}

/**
 * Extracts interaction information (callback, message text, payment)
 */
function getInteractionInfo(ctx: BotContext): string {
  if (!ctx.update) return '';

  // Check for callback query
  // @ts-ignore
  if (ctx.update.callback_query?.data) {
    // @ts-ignore
    return `event - ${ctx.update.callback_query.data}`;
  }

  // Check for message text
  // @ts-ignore
  if (ctx.update.message?.text) {
    // @ts-ignore
    return `type - ${ctx.update.message.text}`;
  }

  // Check for payment
  // @ts-ignore
  if (ctx.update.message?.successful_payment) {
    // @ts-ignore
    const payment = ctx.update.message.successful_payment;
    return `successful payment ${payment.total_amount} ${payment.currency} ${payment.telegram_payment_charge_id} ${payment.provider_payment_charge_id}`;
  }

  return '';
}
