import { isEqual } from 'lodash';

import { User } from '../models';
import { BotContext } from '../shared/context';
import { initialBotState } from '../shared/state';
import { middlewareFn } from '../shared/types';
import { logger } from '../utils/logger';

export function authMiddleware(): middlewareFn<BotContext> {
  return async function (ctx, next) {
    if (ctx.chat?.type !== 'private') {
      return next();
    }

    if (!ctx.from) {
      return logger.error('Context field from is required');
    }

    let user: User | null = await User.findOne({
      where: {
        tgId: ctx.from.id,
      },
    });

    if (!user) {
      user = await User.create({
        tgId: ctx.from.id,
        tgUsername: ctx.from.username,
        tgFirstName: ctx.from.first_name,
        tgLastName: ctx.from.last_name,
      });
      ctx.session.state = initialBotState;
    } else {
      const needUpdate =
        isEqual(ctx.from.username, user.tgUsername) ||
        isEqual(ctx.from.first_name, user.tgFirstName) ||
        isEqual(ctx.from.last_name, user.tgLastName);

      if (needUpdate)
        await user.update({
          tgUsername: ctx.from.username,
          tgFirstName: ctx.from.first_name,
          tgLastName: ctx.from.last_name,
        });
    }

    ctx.user = user;
    await next();
  };
}
