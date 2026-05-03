const logger = require('../utils/logger');
const config = require('../config/config');

module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    logger.info(`Bot online como ${client.user.tag}`);
    logger.info(`Servidores: ${client.guilds.cache.size}`);
    logger.info(`Prefixo ativo: ${config.prefix}`);

    client.user.setPresence({
      status: 'online',
      activities: [
        {
          name: `${config.prefix}help | Server Cloner`,
          type: 3,
        },
      ],
    });
  },
};
