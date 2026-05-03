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
      return message.reply('❌ O bot precisa de permissão de **Administrador** neste servidor.');
    }

    if (!args[0]) {
      return message.reply(
        `**Uso:** \`${config.prefix}clone <link_do_convite>\`\n` +
        `**Exemplo:** \`${config.prefix}clone https://discord.gg/exemplo\`\n\n` +
        `> 💡 Se o bot já está no servidor que quer copiar, use \`${config.prefix}cloneid <ID_do_servidor>\` para uma cópia exata completa.`
      );
    }

    if (!isValidInvite(args[0])) {
      return message.reply('❌ Link de convite inválido. Use o formato: `https://discord.gg/codigo`');
    }

    const code = extractInviteCode(args[0]);

    const checkMsg = await message.reply('🔍 Verificando servidor de origem...');
    const invite = await resolveInvite(message.client, code);

    if (!invite || !invite.guild) {
      return checkMsg.edit('❌ Convite inválido, expirado ou servidor inacessível.');
    }

    const sourceGuild = invite.guild;
    const fullGuild = message.client.guilds.cache.get(sourceGuild.id);

    if (!fullGuild) {
      return checkMsg.edit(
        `⚠️ **Bot não está no servidor "${sourceGuild.name}".**\n\n` +
        `Para uma cópia 1:1 exata, adicione o bot ao servidor de origem com permissão de Administrador.\n\n` +
        `**Link de convite do bot:**\n` +
        `https://discord.com/oauth2/authorize?client_id=${message.client.user.id}&permissions=8&scope=bot`
      );
    }

    await runClone(message, fullGuild, checkMsg);
  },
};

async function runClone(message, sourceGuild, statusMsg) {
  const targetGuild = message.guild;
  const author = message.author;

  // Build info embed for confirmation
  const confirmEmbed = new EmbedBuilder()
    .setColor(0xff9900)
    .setTitle('⚠️ Confirmação — Cópia 1:1 Exata')
    .setThumbnail(sourceGuild.iconURL({ dynamic: true, size: 256 }) || null)
    .addFields(
      { name: '📤 Origem', value: `${sourceGuild.name} (${sourceGuild.id})`, inline: true },
      { name: '📥 Destino', value: `${targetGuild.name} (${targetGuild.id})`, inline: true },
      { name: '🔁 Modo', value: '✅ Cópia completa e exata', inline: true },
      { name: 'O que será copiado', value:
        '🎭 Todos os cargos + permissões\n' +
        '📁 Todas as categorias\n' +
        '💬 Todos os canais (texto, voz, anúncio, fórum, palco)\n' +
        '😀 Emojis\n🎟️ Stickers\n⚙️ Ícone, banner e configurações'
      },
    )
    .setDescription(
      '> ⚠️ **ATENÇÃO:** Todos os canais e cargos atuais serão **deletados** e recriados.\n' +
      '> O progresso será enviado por **DM** pois o canal será deletado durante o processo.\n\n' +
      'Responda com `sim` para confirmar ou `não` para cancelar.'
    )
    .setFooter({ text: 'Você tem 30 segundos para confirmar.' });

  await statusMsg.edit({ content: '', embeds: [confirmEmbed] });

  const filter = (m) =>
    m.author.id === author.id &&
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

  // Open DM for progress updates (channel will be deleted)
  let dm;
  try {
    dm = await author.createDM();
    await dm.send(`🚀 **Clonagem iniciada!**\nCopiando **${sourceGuild.name}** → **${targetGuild.name}**\nAcompanhe o progresso aqui:`);
  } catch {
    dm = null;
  }

  const log = async (text) => {
    logger.info(`[Clone] ${targetGuild.name}: ${text}`);
    if (dm) await dm.send(text).catch(() => {});
  };

  // Start cloning
  await log('📸 Capturando estrutura completa do servidor de origem...');
  let snapshot;
  try {
    snapshot = await snapshotGuild(sourceGuild);
    await log(
      `✅ Snapshot concluído:\n` +
      `• ${snapshot.roles.length} cargos\n` +
      `• ${snapshot.categories.length} categorias\n` +
      `• ${snapshot.channels.length} canais\n` +
      `• ${snapshot.emojis.length} emojis\n` +
      `• ${snapshot.stickers.length} stickers`
    );
  } catch (err) {
    logger.error(`Erro snapshot: ${err.message}`, err);
    return log(`❌ Erro ao capturar origem: ${err.message}`);
  }

  try {
    const report = await applySnapshot(targetGuild, snapshot, log);

    db.saveClone({
      sourceGuildId: sourceGuild.id,
      sourceGuildName: sourceGuild.name,
      targetGuildId: targetGuild.id,
      targetGuildName: sourceGuild.name,
      clonedBy: author.id,
      status: 'completed',
      details: report,
    });

    const resultEmbed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('✅ Cópia 1:1 Concluída!')
      .setThumbnail(snapshot.icon)
      .addFields(
        { name: '📤 Origem', value: sourceGuild.name, inline: true },
        { name: '📥 Destino', value: targetGuild.name, inline: true },
        { name: '\u200b', value: '\u200b', inline: true },
        { name: '🎭 Cargos', value: `✅ ${report.roles.created} | ❌ ${report.roles.failed}`, inline: true },
        { name: '📁 Categorias', value: `✅ ${report.categories.created} | ❌ ${report.categories.failed}`, inline: true },
        { name: '💬 Canais', value: `✅ ${report.channels.created} | ❌ ${report.channels.failed}`, inline: true },
        { name: '😀 Emojis', value: `✅ ${report.emojis.created} | ❌ ${report.emojis.failed}`, inline: true },
        { name: '🎟️ Stickers', value: `✅ ${report.stickers?.created ?? 0} | ❌ ${report.stickers?.failed ?? 0}`, inline: true },
      )
      .setFooter({ text: `Clonado por ${author.tag}` })
      .setTimestamp();

    if (report.errors.length > 0) {
      const errList = report.errors.slice(0, 5).join('\n');
      resultEmbed.addFields({ name: '⚠️ Avisos', value: `\`\`\`\n${errList}\n\`\`\`` });
    }

    if (dm) await dm.send({ embeds: [resultEmbed] }).catch(() => {});

    // Try to send in any available channel
    const firstChannel = targetGuild.channels.cache.find(
      (c) => c.isTextBased() && c.permissionsFor(targetGuild.members.me)?.has('SendMessages')
    );
    if (firstChannel) await firstChannel.send({ embeds: [resultEmbed] }).catch(() => {});

  } catch (err) {
    logger.error(`Erro apply: ${err.message}`, err);
    if (dm) await dm.send(`❌ Erro durante a clonagem: ${err.message}`).catch(() => {});
  }
}

module.exports.runClone = runClone;
