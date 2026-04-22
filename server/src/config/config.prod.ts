import { MidwayAppInfo, MidwayConfig } from '@midwayjs/core';
import { MidwayTransformableInfo } from '@midwayjs/logger';
import { Context } from '@midwayjs/web';
import { EggAppConfig, PowerPartial } from 'egg';

export default (appInfo: MidwayAppInfo) => {
  const config = {} as PowerPartial<EggAppConfig>;

  config.egg = { port: process.env.PORT || 7001 };

  // use for cookie sign key, should change to your own and keep security
  config.keys = appInfo.name + '_20231118221445';
  config.middleware = ['notFound'];

  const bizConfig = {
    sourceUrl: '',
    midwayLogger: {
      clients: {
        fullRecordLogger: {
          fileLogName: 'full-record.log',
          format: (info: MidwayTransformableInfo) => {
            // return `${info.timestamp} ${info.LEVEL} ${info.pid} [${ctx.userId} - ${Date.now() - ctx.startTime}ms ${ctx.method}] ${info.message}`;
            return `${new Date().toISOString()} ${info.message}`;
          },
        },
        cardsLogger: {
          fileLogName: 'cards.log',
          format: (info: MidwayTransformableInfo) => {
            return `${new Date().toISOString()} ${info.message}`;
          },
        },
      },
    },
  };

  // security
  config.security = {
    csrf: { enable: false },
    methodnoallow: { enable: false },
  };

  // CORS
  config.cors = {
    allowMethods: 'GET,HEAD,PUT,POST,DELETE,PATCH,OPTIONS',
    credentials: true,
    origin(ctx: Context) {
      const origin: string = ctx.get('origin');
      // access origin
      if (origin.indexOf('') > -1) {
        // console.log('come in');
        return origin;
      } else {
        return '*';
      }
    },
  };

  // logger
  config.logger = {
    outputJSON: false,
    appLogName: 'app.log',
    coreLogName: 'core.log',
    agentLogName: 'agent.log',
    errorLogName: 'error.log',
  };

  config.customLogger = {
    fullRecordLogger: {
      file: 'full-record.log',
    },
    cardsLogger: {
      file: 'cards.log',
    },
  };

  // business domain
  config.apiDomain = {};

  // jsonwebtoken
  config.jwt = {
    secret: '123456',
    enable: true,
    match(ctx: Context) {
      const reg = /login|register|verify/;
      return !reg.test(ctx.originalUrl);
    },
  };

  // socket io setting
  config.io = {
    namespace: {
      '/socket': {
        connectionMiddleware: ['auth', 'join'],
        packetMiddleware: ['log'],
      },
    },
    redis: {
      host: '192.168.1.6',
      port: 6379,
      password: '98765432',
    },
  };

  config.redis = {
    client: {
      port: 6379,
      host: '192.168.1.6',
      password: '98765432',
      db: 0,
    },
  };

  // AI config
  config.ai = {
    apiUrl: process.env.AI_API_URL || 'https://api.minimaxi.com/v1/chat/completions',
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || 'MiniMax-M2.7',
  };

  return {
    ...bizConfig,
    ...config,
  } as MidwayConfig;
};
