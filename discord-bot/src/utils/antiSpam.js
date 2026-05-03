const logger = require('./logger');

const userMessages = new Map();
const THRESHOLD = 5;
const WINDOW_MS = 5000;
const MUTE_DURATION_MS = 30000;

const mutedUsers = new Set();

function check(message) {
  const userId = message.author.id;

  if (mutedUsers.has(userId)) {
    message.delete().catch(() => {});
    return true;
  }

  const now = Date.now();
  const timestamps = userMessages.get(userId) || [];
  const recent = timestamps.filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  userMessages.set(userId, recent);

  if (recent.length >= THRESHOLD) {
    mutedUsers.add(userId);
    logger.warn(`Anti-spam acionado para ${message.author.tag} (${userId})`);

    message.reply('⚠️ Você está enviando mensagens muito rápido. Aguarde 30 segundos.').catch(() => {});

    setTimeout(() => {
      mutedUsers.delete(userId);
      userMessages.delete(userId);
    }, MUTE_DURATION_MS);

    return true;
  }

  return false;
}

module.exports = { check };
