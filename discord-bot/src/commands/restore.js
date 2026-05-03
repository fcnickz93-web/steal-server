const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { applySnapshot } = require('../services/cloneService');
const db = require('../database/db');
const logger = require('../utils/logger');
const config = require('../config/config');

module.exports = {
  name: 'restore',
  aliases: ['restaurar', 'recover'],
  cooldown: 300,
  description: 'Restaura a estrutura do servidor a partir de um snapshot salvo.',
  usage: '<id_do_snapshot>',

  async execute(message, args) {
    if (!message.guild) return message.reply('❌ Use em servidores.');

    const botMember = message.guild.members.me;
    if (!botMember.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply('❌ O bot precisa de permissão de **Administrador** para restaurar.');
    }

    if (!args[0]) {
      const snapshots = db.getSnapshots(message.guild.id);
      if (!snapshots.length) {
        return message.reply(`❌ Nenhum snapshot encontrado para este servidor.\nUse \`${config.prefix}snapshot\` para criar um.`);
      }

      const list = snapshots
        .map((s) => `**ID ${s.id}** — ${s.created_at} — por <@${s.created_by}>`)
        .join('\n');

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('📋 Snapshots Disponíveis')
        .setDescription(list)
        .setFooter({ text: `Use ${config.prefix}restore <id> para restaurar` });

      return message.reply({ embeds: [embed] });
    }

    const snapshotId = parseInt(args[0], 10);
    if (isNaN(snapshotId)) {
      return message.reply('❌ ID do snapshot inválido. Use um número.');
    }

    const snapshot = db.getSnapshot(snapshotId);
    if (!snapshot || snapshot.guild_id !== message.guild.id) {
      return message.reply('❌ Snapshot não encontrado ou não pertence a este servidor.');
    }

    const warningEmbed = new EmbedBuilder()
      .setColor(0xff9900)
      .setTitle('⚠️ Confirmação de Restauração')
      .setDescription(
        `**Snapshot #${snapshotId}** criado em ${snapshot.created_at}\n\n` +
        '**ATENÇÃO:** Esta operação irá reconstruir o servidor a partir do snapshot.\n' +
        'Todos os canais e cargos atuais serão substituídos.\n\n' +
        'Responda com `sim` para confirmar ou `não` para cancelar.'
      )
      .setFooter({ text: 'Você tem 30 segundos para confirmar.' });

    await message.reply({ embeds: [warningEmbed] });

    const filter = (m) =>
      m.author.id === message.author.id && ['sim', 'não', 'nao', 's', 'n'].includes(m.content.toLowerCase());

    let confirmation;
    try {
      const collected = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });
      confirmation = collected.first().content.toLowerCase();
    } catch {
      return message.channel.send('⏰ Tempo esgotado. Restauração cancelada.');
    }

    if (!['sim', 's'].includes(confirmation)) {
      return message.channel.send('✅ Restauração cancelada.');
    }

    const statusMsg = await message.channel.send('🔄 Iniciando restauração...').catch(() => null);
    const updateStatus = async (text) => {
      if (statusMsg) await statusMsg.edit(text).catch(() => {});
    };

    try {
      const report = await applySnapshot(message.guild, snapshot.snapshot_data, updateStatus);

      const resultEmbed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('✅ Restauração Concluída!')
        .addFields(
          { name: '🆔 Snapshot', value: `#${snapshotId}`, inline: true },
          { name: '🎭 Cargos', value: `✅ ${report.roles.created} | ❌ ${report.roles.failed}`, inline: true },
          { name: '📁 Categorias', value: `✅ ${report.categories.created} | ❌ ${report.categories.failed}`, inline: true },
          { name: '💬 Canais', value: `✅ ${report.channels.created} | ❌ ${report.channels.failed}`, inline: true },
        )
        .setFooter({ text: `Restaurado por ${message.author.tag}` })
        .setTimestamp();

      await message.channel.send({ embeds: [resultEmbed] }).catch(() => {});
      logger.info(`Restauração do snapshot #${snapshotId} concluída em ${message.guild.name}`);
    } catch (err) {
      logger.error(`Erro na restauração: ${err.message}`, err);
      await message.channel.send(`❌ Erro durante a restauração: ${err.message}`).catch(() => {});
    }
  },
};
