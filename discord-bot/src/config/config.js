require('dotenv').config();

const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  prefix: process.env.BOT_PREFIX || '!',
  ownerId: process.env.BOT_OWNER_ID,
  logLevel: process.env.LOG_LEVEL || 'info',
  databasePath: process.env.DATABASE_PATH || './data/bot.db',
  nodeEnv: process.env.NODE_ENV || 'development',

  cooldowns: {
    default: 5,
    clone: 300,
    snapshot: 60,
    template: 30,
  },

  limits: {
    maxCommandLength: 200,
    maxArgsLength: 500,
    antiSpamThreshold: 5,
    antiSpamWindow: 5000,
  },

  permissions: {
    ownerOnly: ['eval', 'reload'],
    adminOnly: ['clone', 'snapshot', 'template', 'restore'],
  },
};

function validate() {
  const required = ['token'];
  const missing = required.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(
      `Variáveis de ambiente obrigatórias não definidas: ${missing.map((k) => k.toUpperCase()).join(', ')}`
    );
  }
}

validate();

module.exports = config;
