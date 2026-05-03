const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { snapshotGuild } = require('../services/cloneService');
const db = require('../database/db');
const logger = require('../utils/logger');

module.exports = {
  name: 'snapshot',
  aliases: ['backup', 'salvar'],
  cooldown: 60,
  description: 'Salva um snapshot (backup) completo da estrutura deste servidor.',
  usage: '',

  async execute(message) {
    if (!message.guild) return message.reply('❌ Use em servidores.');

    const botMember = message.guild.members.me;
    if (!botMember.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply('❌ O bot precisa de permissão de **Administrador** para fazer o snapshot.');
    }

    const statusMsg = await message.reply('📸 Criando snapshot do servidor...');

    try {
      const data = await snapshotGuild(message.guild);
      const result = db.saveSnapshot(
        message.guild.id,
        message.guild.name,
        message.author.id,
        data
      );

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('✅ Snapshot Criado!')
        .setThumbnail(message.guild.iconURL({ dynamic: true }))
        .addFields(
          { name: '🆔 ID do Snapshot', value: `\`${result.lastInsertRowid}\``, inline: true },
          { name: '🏠 Servidor', value: message.guild.name, inline: true },
          { name: '🎭 Cargos salvos', value: `${data.roles.length}`, inline: true },
          { name: '📁 Categorias', value: `${data.categories.length}`, inline: true },
          { name: '💬 Canais', value: `${data.channels.length}`, inline: true },
          { name: '😀 Emojis', value: `${data.emojis.length}`, inline: true },
        )
        .setDescription(`Use \`!restore ${result.lastInsertRowid}\` para restaurar este snapshot.`)
        .setFooter({ text: `Snapshot por ${message.author.tag}` })
        .setTimestamp();

      await statusMsg.edit({ content: '', embeds: [embed] });
      logger.info(`Snapshot ${result.lastInsertRowid} criado por ${message.author.tag} em ${message.guild.name}`);
    } catch (err) {
      logger.error(`Erro no snapshot: ${err.message}`, err);
      await statusMsg.edit(`❌ Erro ao criar snapshot: ${err.message}`);
    }
  },
};
