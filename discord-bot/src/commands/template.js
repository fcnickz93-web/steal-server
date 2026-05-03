const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { fetchTemplate, getGuildTemplates } = require('../services/templateService');
const logger = require('../utils/logger');
const { isValidTemplate, extractTemplateCode } = require('../utils/sanitize');
const config = require('../config/config');

module.exports = {
  name: 'template',
  aliases: ['tmpl', 'servidor-template'],
  cooldown: 30,
  description: 'Aplica um template oficial do Discord neste servidor.',
  usage: '<link_ou_codigo_do_template>',

  async execute(message, args) {
    if (!message.guild) return message.reply('❌ Use em servidores.');

    const botMember = message.guild.members.me;
    if (!botMember.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return message.reply('❌ O bot precisa de permissão de **Gerenciar Servidor**.');
    }

    if (!args[0]) {
      const templates = await getGuildTemplates(message.guild);
      if (!templates.size) {
        return message.reply(
          `❌ Uso correto: \`${config.prefix}template <link_ou_codigo>\`\n` +
          `Exemplo: \`${config.prefix}template https://discord.new/XXXXXXXX\`\n\n` +
          `Você pode encontrar templates em: https://discords.com/servers/templates`
        );
      }

      const list = [...templates.values()]
        .map((t) => `**${t.name}** — por ${t.creator?.tag || 'Desconhecido'}\nCódigo: \`${t.code}\``)
        .join('\n\n');

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('📋 Templates do Servidor')
        .setDescription(list);

      return message.reply({ embeds: [embed] });
    }

    if (!isValidTemplate(args[0]) && !args[0].includes('discord.new')) {
      return message.reply('❌ Link de template inválido. Use o formato: `https://discord.new/codigo`');
    }

    const code = extractTemplateCode(args[0]);
    const statusMsg = await message.reply('🔍 Buscando template...');

    try {
      const template = await fetchTemplate(message.client, code);
      if (!template) {
        return statusMsg.edit('❌ Template não encontrado. Verifique o código e tente novamente.');
      }

      const infoEmbed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('📋 Template Encontrado')
        .addFields(
          { name: 'Nome', value: template.name || 'Sem nome', inline: true },
          { name: 'Criado por', value: template.creator?.tag || 'Desconhecido', inline: true },
          { name: 'Usos', value: `${template.usageCount || 0}`, inline: true },
          { name: 'Descrição', value: template.description || 'Sem descrição.' },
        )
        .setDescription('Responda com `sim` para aplicar este template ou `não` para cancelar.\n\n⚠️ **Os canais atuais serão reorganizados.**')
        .setFooter({ text: 'Você tem 30 segundos para confirmar.' });

      await statusMsg.edit({ content: '', embeds: [infoEmbed] });

      const filter = (m) =>
        m.author.id === message.author.id && ['sim', 'não', 'nao', 's', 'n'].includes(m.content.toLowerCase());

      let confirmation;
      try {
        const collected = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });
        confirmation = collected.first().content.toLowerCase();
      } catch {
        return message.channel.send('⏰ Tempo esgotado. Operação cancelada.');
      }

      if (!['sim', 's'].includes(confirmation)) {
        return message.channel.send('✅ Operação cancelada.');
      }

      await message.channel.send('⚙️ Aplicando template...');

      await template.sync();

      const successEmbed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('✅ Template sincronizado!')
        .setDescription(`O template **${template.name}** foi sincronizado com sucesso.`)
        .setFooter({ text: `Por ${message.author.tag}` })
        .setTimestamp();

      await message.channel.send({ embeds: [successEmbed] }).catch(() => {});
      logger.info(`Template "${template.name}" aplicado em ${message.guild.name} por ${message.author.tag}`);
    } catch (err) {
      logger.error(`Erro ao aplicar template: ${err.message}`, err);
      await message.channel.send(`❌ Erro ao aplicar template: ${err.message}`).catch(() => {});
    }
  },
};
