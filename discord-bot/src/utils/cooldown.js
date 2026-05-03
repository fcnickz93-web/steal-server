const cooldowns = new Map();

function check(userId, commandName, seconds) {
  const key = `${userId}:${commandName}`;
  const now = Date.now();

  if (cooldowns.has(key)) {
    const expiry = cooldowns.get(key);
    if (now < expiry) {
      const remaining = ((expiry - now) / 1000).toFixed(1);
      return { onCooldown: true, remaining };
    }
  }

  cooldowns.set(key, now + seconds * 1000);
  setTimeout(() => cooldowns.delete(key), seconds * 1000);

  return { onCooldown: false };
}

module.exports = { check };
