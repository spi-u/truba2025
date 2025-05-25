import { Telegraf } from 'telegraf';

import { Command } from '../shared/command';
import { BotContext } from '../shared/context';

export class StartCommand extends Command {
  constructor(bot: Telegraf<BotContext>) {
    super(bot);
  }

  handle() {
    this.bot.start(async (ctx) => {
      return ctx.reply(
        'Привет! Просто введи свой запрос и я помогу тебе с управлением таблицами',
      );
    });
  }
}
