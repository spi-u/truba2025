import { Sequelize } from 'sequelize';

import { User, Session, USER_FIELDS, SESSION_FIELDS } from './models';
import { logger } from './utils/logger';

const db = new Sequelize({
  dialect: 'postgres',
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  logging: false,
  // pool: {
  //   acquire: 35000,
  //   idle: 10000,
  //   max: 50,
  //   min: 0,
  // },
});

User.init(USER_FIELDS, { sequelize: db });
Session.init(SESSION_FIELDS, { sequelize: db });

export const start = async () => {
  if (process.env.NODE_ENV === 'development') {
    await db.sync({
      force: true,
    });
  }

  try {
    await db.authenticate();
    logger.info('Connection has been established successfully.');
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
  }
};

export default db;
