const { reload } = require('../handlers/commandHandler');
const { isOwner } = require('../utils/permissions');
const config = require('../config/config');

module.exports = {
  name: 'reload',
  aliases: ['recarregar'],
  cooldown: 3,
  description: '[Owner] Recarrega um comando sem reiniciar o bot.',
  usage: '<nome_do_comando>',

  execute(message, args, client) {
    if (!isOwner(message.author.id)) {
      return message.reply('❌ Apenas o dono do bot pode usar este comando.');
    }

    if (!args[0]) {
      return message.reply(`❌ Uso: \`${config.prefix}reload <comando>\``);
    }

    const commandName = args[0].toLowerCase();
    const success = reload(client, commandName);

    if (success) {
      message.reply(`✅ Comando \`${commandName}\` recarregado com sucesso.`);
    } else {
      message.reply(`❌ Comando \`${commandName}\` não encontrado.`);
    }
  },
};
