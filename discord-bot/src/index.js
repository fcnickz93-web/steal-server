require('dotenv').config();

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./config/config');
const logger = require('./utils/logger');
const commandHandler = require('./handlers/commandHandler');
const eventHandler = require('./handlers/eventHandler');
const db = require('./database/db');

process.on('uncaughtException', (err) => {
  logger.error(`[UNCAUGHT EXCEPTION] ${err.message}`, err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error(`[UNHANDLED REJECTION] ${reason}`);
});

process.on('SIGTERM', () => {
  logger.info('Sinal SIGTERM recebido. Encerrando graciosamente...');
  client.destroy();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Sinal SIGINT recebido. Encerrando...');
  client.destroy();
  process.exit(0);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
  allowedMentions: { parse: ['users', 'roles'], repliedUser: true },
});

db.init();
commandHandler.load(client);
eventHandler.load(client);

logger.info('Conectando ao Discord...');
client.login(config.token).catch((err) => {
  logger.error(`Falha ao conectar: ${err.message}`);
  process.exit(1);
});
