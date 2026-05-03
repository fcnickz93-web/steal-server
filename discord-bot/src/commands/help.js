const config = require('../config/config');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'help',
  aliases: ['h', 'comandos', 'commands'],
  cooldown: 5,
  description: 'Lista todos os comandos disponíveis.',
  usage: '[comando]',

  execute(message, args, client) {
    const prefix = config.prefix;

    if (args[0]) {
      const name = args[0].toLowerCase();
      const cmd = client.commands.get(name) || client.commands.get(client.aliases.get(name));
      if (!cmd) {
        return message.reply(`❌ Comando \`${name}\` não encontrado.`);
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📖 Comando: ${prefix}${cmd.name}`)
        .addFields(
          { name: 'Descrição', value: cmd.description || 'Sem descrição.' },
          { name: 'Uso', value: `\`${prefix}${cmd.name} ${cmd.usage || ''}\``.trim() },
          { name: 'Aliases', value: cmd.aliases?.length ? cmd.aliases.map((a) => `\`${a}\``).join(', ') : 'Nenhum' },
          { name: 'Cooldown', value: `${cmd.cooldown ?? 5}s` }
        )
        .setFooter({ text: `Server Cloner Bot • ${new Date().toLocaleDateString('pt-BR')}` });

      return message.reply({ embeds: [embed] });
    }

    const categories = {
      '🤖 Geral': ['ping', 'help', 'info'],
      '🔁 Clonagem': ['clone', 'snapshot', 'restore', 'template'],
    };

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('📋 Comandos do Server Cloner Bot')
      .setDescription(`Prefixo: \`${prefix}\` | Use \`${prefix}help <comando>\` para detalhes.`)
      .setThumbnail(message.client.user.displayAvatarURL())
      .setFooter({ text: 'Server Cloner Bot • Desenvolvido para produção' });

    for (const [category, names] of Object.entries(categories)) {
      const cmds = names
        .map((n) => client.commands.get(n))
        .filter(Boolean)
        .map((c) => `\`${prefix}${c.name}\` — ${c.description || 'Sem descrição.'}`)
        .join('\n');

      if (cmds) embed.addFields({ name: category, value: cmds });
    }

    message.reply({ embeds: [embed] });
  },
};
