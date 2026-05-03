const logger = require('../utils/logger');
const config = require('../config/config');

module.exports = {
  name: 'guildCreate',
  execute(guild) {
    logger.info(`Bot adicionado ao servidor: ${guild.name} (${guild.id}) | Membros: ${guild.memberCount}`);

    const systemChannel = guild.systemChannel;
    if (systemChannel) {
      systemChannel
        .send(
          `👋 Olá! Sou o **Server Cloner Bot**.\n\nUse \`${config.prefix}help\` para ver todos os comandos disponíveis.`
        )
        .catch(() => {});
    }
  },
};
