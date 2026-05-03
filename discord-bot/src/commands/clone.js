const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { resolveInvite, snapshotGuild, applySnapshot } = require('../services/cloneService');
const db = require('../database/db');
const logger = require('../utils/logger');
const { isValidInvite, extractInviteCode } = require('../utils/sanitize');
const config = require('../config/config');

module.exports = {
  name: 'clone',
  aliases: ['clonar', 'copiar'],
  cooldown: 300,
  description: 'Clona completamente outro servidor Discord para este servidor.',
  usage: '<link_do_convite>',

  async execute(message, args) {
    if (!message.guild) return message.reply('❌ Este comando só pode ser usado em servidores.');

    const botMember = message.guild.members.me;
    if (!botMember.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply('❌ O bot precisa de permissão de **Administrador** neste servidor para clonar.');
    }

    if (!args[0]) {
      return message.reply(
        `**Uso:** \`${config.prefix}clone <link_do_convite>\`\n` +
        `**Exemplo:** \`${config.prefix}clone https://discord.gg/exemplo\`\n\n` +
        `> ⚠️ Para clonagem **completa** (cargos, canais, permissões, emojis, stickers), o bot precisa estar **nos dois servidores** com permissão de Administrador.`
      );
    }

    const input = args[0];
    if (!isValidInvite(input)) {
      return message.reply('❌ Link de convite inválido. Use o formato: `https://discord.gg/codigo`');
    }

    const code = extractInviteCode(input);

    // ── Resolve invite first to show info ─────────────────────────────────
    const checkMsg = await message.reply('🔍 Verificando servidor de origem...');
    const invite = await resolveInvite(message.client, code);

    if (!invite || !invite.guild) {
      return checkMsg.edit('❌ Convite inválido, expirado ou servidor inacessível.');
    }

    const sourceGuild = invite.guild;
    const fullGuild = message.client.guilds.cache.get(sourceGuild.id);
    const isFullClone = !!fullGuild;

    const previewEmbed = new EmbedBuilder()
      .setColor(isFullClone ? 0xff9900 : 0xed4245)
      .setTitle('⚠️ Confirmação de Clonagem')
      .setThumbnail(sourceGuild.iconURL({ dynamic: true, size: 256 }) || null)
      .addFields(
        { name: '📤 Servidor de Origem', value: sourceGuild.name, inline: true },
        { name: '📥 Destino', value: message.guild.name, inline: true },
        { name: '🔁 Modo', value: isFullClone ? '✅ Clonagem completa' : '⚠️ Parcial (bot não está na origem)', inline: true },
      )
      .setDescription(
        `**O que será copiado ${isFullClone ? '(completo)' : '(parcial)'}:**\n` +
        (isFullClone
          ? '✅ Cargos + Permissões\n✅ Categorias\n✅ Canais (texto, voz, anúncio, fórum, palco)\n✅ Emojis\n✅ Stickers\n✅ Configurações do servidor\n✅ Ícone e banner'
          : '⚠️ Apenas nome e ícone\n❌ Sem cargos, canais ou emojis\n\n💡 Adicione o bot ao servidor de origem para clonagem completa.') +
        '\n\n**Esta ação deletará todos os canais e cargos atuais deste servidor.**\n\nResponda com `sim` para confirmar ou `não` para cancelar.'
      )
      .setFooter({ text: 'Você tem 30 segundos para confirmar.' });

    await checkMsg.edit({ content: '', embeds: [previewEmbed] });

    const filter = (m) =>
      m.author.id === message.author.id &&
      ['sim', 'não', 'nao', 's', 'n'].includes(m.content.toLowerCase());

    let confirmation;
    try {
      const collected = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });
      confirmation = collected.first().content.toLowerCase();
    } catch {
      return message.channel.send('⏰ Tempo esgotado. Clonagem cancelada.');
    }

    if (!['sim', 's'].includes(confirmation)) {
      return message.channel.send('✅ Clonagem cancelada.');
    }

    const statusMsg = await message.channel.send('⏳ Iniciando clonagem...').catch(() => null);
    const updateStatus = async (text) => {
      if (statusMsg) await statusMsg.edit(text).catch(() => {});
      logger.info(`[Clone] ${message.guild.name}: ${text}`);
    };

    let snapshot;
    try {
      if (isFullClone) {
        await updateStatus('📸 Capturando estrutura completa do servidor de origem...');
        snapshot = await snapshotGuild(fullGuild);
      } else {
        snapshot = {
          name: sourceGuild.name,
          description: sourceGuild.description || null,
          icon: sourceGuild.iconURL({ extension: 'png', size: 4096 }) || null,
          banner: null, splash: null,
          verificationLevel: 0, explicitContentFilter: 0,
          defaultMessageNotifications: 0, afkTimeout: 300,
          preferredLocale: 'pt-BR',
          roles: [], categories: [], channels: [], emojis: [], stickers: [],
        };
        await updateStatus('⚠️ Modo parcial — bot não está na origem. Copiando apenas nome e ícone...');
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (err) {
      logger.error(`Erro ao fazer snapshot: ${err.message}`, err);
      return updateStatus(`❌ Erro ao capturar servidor de origem: ${err.message}`);
    }

    try {
      const report = await applySnapshot(message.guild, snapshot, updateStatus);

      db.saveClone({
        sourceGuildId: sourceGuild.id,
        sourceGuildName: sourceGuild.name,
        targetGuildId: message.guild.id,
        targetGuildName: message.guild.name,
        clonedBy: message.author.id,
        status: 'completed',
        details: report,
      });

      const resultEmbed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('✅ Clonagem Concluída!')
        .setThumbnail(snapshot.icon)
        .addFields(
          { name: '📤 Origem', value: sourceGuild.name, inline: true },
          { name: '📥 Destino', value: message.guild.name, inline: true },
          { name: '\u200b', value: '\u200b', inline: true },
          { name: '🎭 Cargos', value: `✅ ${report.roles.created} | ❌ ${report.roles.failed}`, inline: true },
          { name: '📁 Categorias', value: `✅ ${report.categories.created} | ❌ ${report.categories.failed}`, inline: true },
          { name: '💬 Canais', value: `✅ ${report.channels.created} | ❌ ${report.channels.failed}`, inline: true },
          { name: '😀 Emojis', value: `✅ ${report.emojis.created} | ❌ ${report.emojis.failed}`, inline: true },
          { name: '🎟️ Stickers', value: `✅ ${report.stickers?.created ?? 0} | ❌ ${report.stickers?.failed ?? 0}`, inline: true },
        )
        .setFooter({ text: `Clonado por ${message.author.tag}` })
        .setTimestamp();

      if (report.errors.length > 0) {
        const errList = report.errors.slice(0, 5).join('\n');
        resultEmbed.addFields({ name: '⚠️ Avisos', value: `\`\`\`\n${errList}\n\`\`\`` });
      }

      await message.channel.send({ embeds: [resultEmbed] }).catch(() => {});
    } catch (err) {
      logger.error(`Erro ao aplicar snapshot: ${err.message}`, err);
      await message.channel.send(`❌ Erro durante a clonagem: ${err.message}`).catch(() => {});
    }
  },
};
