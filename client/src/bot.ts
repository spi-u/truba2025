import { Markup, Scenes, Telegraf, Telegram } from 'telegraf';

import { VoiceCommand } from './commands';
import { StartCommand } from './commands/start-command';
import {
  authMiddleware,
  sessionDbMiddleware,
  logMiddleware,
} from './middlewares';
import { Command } from './shared/command';
import { BotContext } from './shared/context';
import { logger } from './utils/logger';

const RELOAD_CALLBACK_ACTION = 'reload_scene';

class Bot {
  bot: Telegraf<BotContext>;
  telegram: Telegram;
  commands: Command[] = [];
  stage: Scenes.Stage<any>;

  constructor(token: string) {
    this.bot = new Telegraf<BotContext>(token);
    this.telegram = this.bot.telegram;

    this.commands = [new StartCommand(this.bot), new VoiceCommand(this.bot)];

    this.stage = new Scenes.Stage<any>([]);
  }

  init() {
    this.bot.use(sessionDbMiddleware());
    this.bot.use(authMiddleware());
    this.bot.use(async (ctx: BotContext, next: () => void) => {
      ctx.deleteMessageOrClearReplyMarkup = async () => {
        try {
          await ctx.deleteMessage();
        } catch (e) {
          console.log(e);
          await ctx.editMessageReplyMarkup(undefined);
        }
      };
      return next();
    });
    this.stage.use(logMiddleware());
    this.bot.use(this.stage.middleware());

    this.bot.on('pre_checkout_query', async (ctx) => {
      return ctx.answerPreCheckoutQuery(true);
    });

    this.bot.catch(async (err, ctx) => {
      logger.error(err);

      try {
        if (ctx.session.__scenes && ctx.session.__scenes.current) {
          await ctx.sendMessage(
            'Возникла непредвиденная ошибка',
            Markup.inlineKeyboard([
              Markup.button.callback('Перезагрузить', RELOAD_CALLBACK_ACTION),
            ]),
          );
        } else {
          await ctx.sendMessage('Возникла непредвиденная ошибка');
        }
      } catch (e) {
        console.log(e);
      }
    });

    this.bot.action(RELOAD_CALLBACK_ACTION, async (ctx) => {
      if (ctx.session.__scenes && ctx.session.__scenes.current) {
        await ctx.deleteMessageOrClearReplyMarkup();
        return ctx.scene.enter(ctx.session.__scenes.current);
      }
    });

    for (const command of this.commands) {
      command.handle();
    }

    // this.bot.telegram.setMyCommands([
    //   { command: 'start', description: 'Начать регистрацию' },
    // ]);

    this.bot
      .launch({
        ...(process.env.WEBHOOK_DOMAIN && {
          webhook: {
            domain: process.env.WEBHOOK_DOMAIN,
          },
        }),
      })
      .catch((e) => {
        logger.error('Starting bot error:', e);
      });
  }
}

export default Bot;
