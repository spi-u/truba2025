import Bot from './bot';
import { start as startDb } from './db';
import { logger } from './utils/logger';

export let bot: Bot;

const start = async () => {
  await startDb();

  logger.debug(process.env.NODE_ENV);

  const token = process.env.BOT_TOKEN;
  if (!token) return logger.error('BOT_TOKEN is required');

  bot = new Bot(token);

  bot.init();
};

start();
