module.exports = {
  name: 'ping',
  aliases: ['p', 'latency'],
  cooldown: 5,
  description: 'Mostra a latência do bot e da API do Discord.',
  usage: '',

  async execute(message) {
    const sent = await message.reply('🏓 Calculando...');
    const latency = sent.createdTimestamp - message.createdTimestamp;
    const apiLatency = Math.round(message.client.ws.ping);

    const status = (ms) => (ms < 100 ? '🟢' : ms < 200 ? '🟡' : '🔴');

    await sent.edit(
      `🏓 **Pong!**\n` +
      `${status(latency)} Latência da mensagem: \`${latency}ms\`\n` +
      `${status(apiLatency)} Latência da API: \`${apiLatency}ms\``
    );
  },
};
