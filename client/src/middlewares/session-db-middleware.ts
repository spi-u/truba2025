import { Session } from '../models';
import { BotContext } from '../shared/context';
import { middlewareFn } from '../shared/types';
import { getSessionKey } from '../utils/session';

export function sessionDbMiddleware(): middlewareFn<BotContext> {
  return async function (ctx, next) {
    const key = await getSessionKey(ctx);
    if (!key) {
      return next();
    }

    const session = await Session.findOne({
      where: { key },
    });

    let sessionData = session?.data || {};

    Object.defineProperty(ctx, 'session', {
      get: function () {
        return sessionData;
      },
      set: function (newValue) {
        sessionData = Object.assign({}, newValue);
      },
    });

    await next();

    if (session) {
      await Session.update(
        {
          data: sessionData,
        },
        {
          where: { key },
        },
      );
    } else {
      return Session.create({
        key,
        data: sessionData,
      });
    }
  };
}
