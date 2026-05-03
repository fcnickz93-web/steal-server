const logger = require('../utils/logger');

async function fetchTemplate(client, code) {
  try {
    const template = await client.fetchGuildTemplate(code);
    return template;
  } catch (err) {
    logger.error(`Erro ao buscar template: ${err.message}`);
    return null;
  }
}

async function createGuildFromTemplate(client, code, name, icon = null) {
  try {
    const template = await client.fetchGuildTemplate(code);
    const guild = await template.createGuild(name, icon);
    logger.info(`Servidor criado a partir do template "${code}": ${guild.name} (${guild.id})`);
    return guild;
  } catch (err) {
    logger.error(`Erro ao criar servidor pelo template: ${err.message}`);
    return null;
  }
}

async function getGuildTemplates(guild) {
  try {
    const templates = await guild.fetchTemplates();
    return templates;
  } catch {
    return new Map();
  }
}

async function syncTemplate(template) {
  try {
    await template.sync();
    return true;
  } catch {
    return false;
  }
}

module.exports = { fetchTemplate, createGuildFromTemplate, getGuildTemplates, syncTemplate };
