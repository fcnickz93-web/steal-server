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
  description: 'Clona a estrutura de outro servidor Discord para este servidor.',
  usage: '<link_do_convite>',

  async execute(message, args) {
    if (!message.guild) {
      return message.reply('❌ Este comando só pode ser usado em servidores.');
    }

    const botMember = message.guild.members.me;
    if (!botMember.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply('❌ O bot precisa de permissão de **Administrador** neste servidor para clonar.');
    }

    if (!args[0]) {
      return message.reply(
        `❌ Uso correto: \`${config.prefix}clone <link_do_convite>\`\n` +
        `Exemplo: \`${config.prefix}clone https://discord.gg/exemplo\``
      );
    }

    const input = args[0];
    if (!isValidInvite(input)) {
      return message.reply('❌ Link de convite inválido. Use o formato: `https://discord.gg/codigo`');
    }

    const code = extractInviteCode(input);

    const warningEmbed = new EmbedBuilder()
      .setColor(0xff9900)
      .setTitle('⚠️ Confirmação de Clonagem')
      .setDescription(
        '**ATENÇÃO:** Esta operação irá:\n\n' +
        '• Deletar **todos os canais** deste servidor\n' +
        '• Deletar **todos os cargos** gerenciáveis\n' +
        '• Recriar a estrutura do servidor de origem\n\n' +
        '**Esta ação é IRREVERSÍVEL sem um snapshot prévio.**\n\n' +
        `Responda com \`sim\` para confirmar ou \`não\` para cancelar.`
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
      return message.channel.send('⏰ Tempo esgotado. Clonagem cancelada.');
    }

    if (!['sim', 's'].includes(confirmation)) {
      return message.channel.send('✅ Clonagem cancelada pelo usuário.');
    }

    const statusMsg = await message.channel.send('🔍 Resolvendo convite...').catch(() => null);

    const updateStatus = async (text) => {
      if (statusMsg) await statusMsg.edit(text).catch(() => {});
      logger.info(`Clone em ${message.guild.name}: ${text}`);
    };

    await updateStatus('🔍 Buscando informações do servidor de origem...');

    const invite = await resolveInvite(message.client, code);
    if (!invite) {
      return updateStatus('❌ Convite inválido ou expirado. Certifique-se de que o link seja permanente.');
    }

    const sourceGuild = invite.guild;
    if (!sourceGuild) {
      return updateStatus('❌ Não foi possível obter informações do servidor. O convite pode ser temporário.');
    }

    await updateStatus(`📡 Servidor encontrado: **${sourceGuild.name}**. Iniciando clonagem...`);

    let snapshot;
    try {
      const fullGuild = message.client.guilds.cache.get(sourceGuild.id);
      if (fullGuild) {
        await updateStatus(`🔎 Bot está no servidor de origem. Fazendo snapshot completo...`);
        snapshot = await snapshotGuild(fullGuild);
      } else {
        snapshot = {
          name: sourceGuild.name,
          description: sourceGuild.description || null,
          icon: sourceGuild.iconURL({ dynamic: true, size: 4096 }) || null,
          banner: null,
          verificationLevel: 0,
          explicitContentFilter: 0,
          defaultMessageNotifications: 0,
          roles: [],
          categories: [],
          channels: [],
          emojis: [],
        };
        await updateStatus(
          `⚠️ O bot não está no servidor de origem. Apenas o nome e ícone serão copiados.\n` +
          `> **Dica:** Adicione o bot ao servidor de origem para uma clonagem completa.`
        );
        await new Promise((r) => setTimeout(r, 3000));
      }
    } catch (err) {
      logger.error(`Erro ao criar snapshot: ${err.message}`, err);
      return updateStatus(`❌ Erro ao capturar estrutura: ${err.message}`);
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
        )
        .setFooter({ text: `Clonado por ${message.author.tag}` })
        .setTimestamp();

      if (report.errors.length > 0) {
        const errList = report.errors.slice(0, 5).join('\n');
        resultEmbed.addFields({ name: '⚠️ Avisos', value: `\`\`\`${errList}\`\`\`` });
      }

      await message.channel.send({ embeds: [resultEmbed] }).catch(() => {});
    } catch (err) {
      logger.error(`Erro ao aplicar snapshot: ${err.message}`, err);
      await message.channel.send(`❌ Erro durante a clonagem: ${err.message}`).catch(() => {});
    }
  },
};
