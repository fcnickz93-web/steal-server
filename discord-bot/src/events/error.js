const logger = require('../utils/logger');

module.exports = {
  name: 'error',
  execute(error) {
    logger.error(`Erro no cliente Discord: ${error.message}`, error);
  },
};
