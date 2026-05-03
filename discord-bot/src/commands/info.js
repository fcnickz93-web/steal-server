const { EmbedBuilder } = require('discord.js');
const config = require('../config/config');

module.exports = {
  name: 'info',
  aliases: ['botinfo', 'about'],
  cooldown: 10,
  description: 'Exibe informações do bot e do servidor.',
  usage: '',

  execute(message, _args, client) {
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    const memMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('ℹ️ Informações do Bot')
      .setThumbnail(client.user.displayAvatarURL())
      .addFields(
        { name: '🤖 Bot', value: client.user.tag, inline: true },
        { name: '🌐 Servidores', value: `${client.guilds.cache.size}`, inline: true },
        { name: '👥 Usuários', value: `${client.users.cache.size}`, inline: true },
        { name: '⏱️ Uptime', value: `${days}d ${hours}h ${minutes}m ${seconds}s`, inline: true },
        { name: '💾 Memória', value: `${memMB} MB`, inline: true },
        { name: '📡 Ping', value: `${Math.round(client.ws.ping)}ms`, inline: true },
        { name: '🔧 Versão Node', value: process.version, inline: true },
        { name: '📦 discord.js', value: require('discord.js').version, inline: true },
        { name: '🔑 Prefixo', value: `\`${config.prefix}\``, inline: true },
      )
      .setFooter({ text: 'Server Cloner Bot • Pronto para produção' })
      .setTimestamp();

    message.reply({ embeds: [embed] });
  },
};
