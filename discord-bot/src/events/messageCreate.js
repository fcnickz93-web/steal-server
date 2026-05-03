const config = require('../config/config');
const cooldown = require('../utils/cooldown');
const permissions = require('../utils/permissions');
const antiSpam = require('../utils/antiSpam');
const { sanitizeArgs } = require('../utils/sanitize');
const db = require('../database/db');
const logger = require('../utils/logger');

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (message.author.bot) return;
    if (!message.content.startsWith(config.prefix)) return;

    if (antiSpam.check(message)) return;

    const raw = message.content.slice(config.prefix.length).trim();
    const [commandName, ...rawArgs] = raw.split(/\s+/);
    const args = sanitizeArgs(rawArgs);

    const name = commandName.toLowerCase();
    const resolvedName = client.aliases.get(name) || name;
    const command = client.commands.get(resolvedName);

    if (!command) return;

    if (!permissions.check(message, resolvedName)) {
      return message.reply('❌ Você não tem permissão para usar este comando.');
    }

    const cooldownSeconds = command.cooldown ?? config.cooldowns.default;
    const cd = cooldown.check(message.author.id, resolvedName, cooldownSeconds);
    if (cd.onCooldown) {
      return message.reply(
        `⏳ Aguarde **${cd.remaining}s** antes de usar \`${config.prefix}${resolvedName}\` novamente.`
      );
    }

    try {
      await command.execute(message, args, client);
      db.logCommand(message.author.id, message.author.tag, message.guild?.id, resolvedName, args, true);
    } catch (err) {
      logger.error(`Erro no comando "${resolvedName}" por ${message.author.tag}: ${err.message}`, err);
      db.logCommand(message.author.id, message.author.tag, message.guild?.id, resolvedName, args, false);
      message.reply('❌ Ocorreu um erro ao executar o comando. Tente novamente mais tarde.').catch(() => {});
    }
  },
};
