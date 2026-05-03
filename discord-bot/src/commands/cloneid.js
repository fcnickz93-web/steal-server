const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { snapshotGuild, applySnapshot } = require('../services/cloneService');
const db = require('../database/db');
const logger = require('../utils/logger');
const config = require('../config/config');

module.exports = {
  name: 'cloneid',
  aliases: ['cloneserver', 'clonarid'],
  cooldown: 300,
  description: 'Clona um servidor pelo ID (o bot precisa estar nele).',
  usage: '<ID_do_servidor>',

  async execute(message, args) {
    if (!message.guild) return message.reply('❌ Use em servidores.');

    const botMember = message.guild.members.me;
    if (!botMember.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply('❌ O bot precisa de permissão de **Administrador** neste servidor.');
    }

    if (!args[0]) {
      // List guilds the bot is in
      const guilds = message.client.guilds.cache
        .filter((g) => g.id !== message.guild.id)
        .map((g) => `\`${g.id}\` — **${g.name}**`)
        .join('\n') || 'O bot não está em nenhum outro servidor.';

      return message.reply(
        `**Uso:** \`${config.prefix}cloneid <ID_do_servidor>\`\n\n` +
        `**Servidores disponíveis para clonar:**\n${guilds}`
      );
    }

    const sourceId = args[0].trim();
    if (!/^\d{17,20}$/.test(sourceId)) {
      return message.reply('❌ ID inválido. IDs do Discord têm entre 17 e 20 dígitos numéricos.');
    }

    if (sourceId === message.guild.id) {
      return message.reply('❌ Não é possível clonar um servidor para ele mesmo.');
    }

    const sourceGuild = message.client.guilds.cache.get(sourceId);
    if (!sourceGuild) {
      const botGuilds = message.client.guilds.cache
        .filter((g) => g.id !== message.guild.id)
        .map((g) => `\`${g.id}\` — ${g.name}`)
        .join('\n') || 'nenhum';

      return message.reply(
        `❌ Bot não está no servidor \`${sourceId}\`.\n\n` +
        `**Servidores que o bot está:**\n${botGuilds}`
      );
    }

    const { runClone } = require('./clone');
    const checkMsg = await message.reply(`🔍 Servidor encontrado: **${sourceGuild.name}** — preparando clonagem...`);
    await runClone(message, sourceGuild, checkMsg);
  },
};
