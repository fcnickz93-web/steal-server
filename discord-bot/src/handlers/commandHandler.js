const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

function load(client) {
  client.commands = new Map();
  client.aliases = new Map();

  const commandsPath = path.join(__dirname, '..', 'commands');
  const files = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));

  for (const file of files) {
    try {
      const command = require(path.join(commandsPath, file));

      if (!command.name || typeof command.execute !== 'function') {
        logger.warn(`Comando inválido ignorado: ${file} (faltando name ou execute)`);
        continue;
      }

      client.commands.set(command.name, command);

      if (command.aliases && Array.isArray(command.aliases)) {
        for (const alias of command.aliases) {
          client.aliases.set(alias, command.name);
        }
      }

      logger.info(`Comando carregado: ${command.name}`);
    } catch (err) {
      logger.error(`Erro ao carregar comando ${file}: ${err.message}`);
    }
  }

  logger.info(`Total de comandos carregados: ${client.commands.size}`);
}

function reload(client, commandName) {
  const commandsPath = path.join(__dirname, '..', 'commands');
  const files = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));

  for (const file of files) {
    const fullPath = path.join(commandsPath, file);
    const command = require(fullPath);
    if (command.name === commandName) {
      delete require.cache[require.resolve(fullPath)];
      const newCommand = require(fullPath);
      client.commands.set(commandName, newCommand);
      logger.info(`Comando recarregado: ${commandName}`);
      return true;
    }
  }
  return false;
}

module.exports = { load, reload };
