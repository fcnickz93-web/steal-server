const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

function load(client) {
  const eventsPath = path.join(__dirname, '..', 'events');
  const files = fs.readdirSync(eventsPath).filter((f) => f.endsWith('.js'));

  for (const file of files) {
    try {
      const event = require(path.join(eventsPath, file));

      if (!event.name || typeof event.execute !== 'function') {
        logger.warn(`Evento inválido ignorado: ${file}`);
        continue;
      }

      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args) => event.execute(...args, client));
      }

      logger.info(`Evento registrado: ${event.name}`);
    } catch (err) {
      logger.error(`Erro ao carregar evento ${file}: ${err.message}`);
    }
  }
}

module.exports = { load };
