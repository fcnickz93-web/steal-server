const { PermissionsBitField, ChannelType } = require('discord.js');
const logger = require('../utils/logger');

async function resolveInvite(client, code) {
  try {
    const invite = await client.fetchInvite(code);
    return invite;
  } catch {
    return null;
  }
}

async function snapshotGuild(guild) {
  const snapshot = {
    name: guild.name,
    description: guild.description || null,
    icon: guild.iconURL({ dynamic: true, size: 4096 }) || null,
    banner: guild.bannerURL({ size: 4096 }) || null,
    verificationLevel: guild.verificationLevel,
    explicitContentFilter: guild.explicitContentFilter,
    defaultMessageNotifications: guild.defaultMessageNotifications,
    roles: [],
    categories: [],
    channels: [],
    emojis: [],
  };

  await guild.roles.fetch();
  const roles = guild.roles.cache
    .filter((r) => !r.managed && r.id !== guild.id)
    .sort((a, b) => b.position - a.position);

  snapshot.roles = roles.map((r) => ({
    name: r.name,
    color: r.color,
    hoist: r.hoist,
    mentionable: r.mentionable,
    permissions: r.permissions.bitfield.toString(),
    position: r.position,
  }));

  await guild.channels.fetch();
  const categories = guild.channels.cache.filter((c) => c.type === ChannelType.GuildCategory);
  const channels = guild.channels.cache.filter((c) => c.type !== ChannelType.GuildCategory);

  snapshot.categories = categories.map((c) => ({
    name: c.name,
    position: c.position,
    permissionOverwrites: c.permissionOverwrites.cache.map((o) => ({
      id: o.id,
      type: o.type,
      allow: o.allow.bitfield.toString(),
      deny: o.deny.bitfield.toString(),
    })),
  }));

  snapshot.channels = channels.map((c) => ({
    name: c.name,
    type: c.type,
    position: c.position,
    topic: c.topic || null,
    nsfw: c.nsfw || false,
    rateLimitPerUser: c.rateLimitPerUser || 0,
    userLimit: c.userLimit || 0,
    bitrate: c.bitrate || null,
    parentName: c.parent?.name || null,
    permissionOverwrites: c.permissionOverwrites?.cache?.map((o) => ({
      id: o.id,
      type: o.type,
      allow: o.allow.bitfield.toString(),
      deny: o.deny.bitfield.toString(),
    })) || [],
  }));

  try {
    await guild.emojis.fetch();
    snapshot.emojis = guild.emojis.cache.map((e) => ({
      name: e.name,
      url: e.url,
      animated: e.animated,
    }));
  } catch {
    snapshot.emojis = [];
  }

  return snapshot;
}

async function applySnapshot(targetGuild, snapshot, progressCallback) {
  const report = {
    roles: { created: 0, failed: 0 },
    categories: { created: 0, failed: 0 },
    channels: { created: 0, failed: 0 },
    emojis: { created: 0, failed: 0 },
    errors: [],
  };

  const roleMap = new Map();

  await progressCallback('🗑️ Limpando estrutura atual...');

  try {
    const channelsToDel = targetGuild.channels.cache.filter((c) => c.deletable);
    for (const ch of channelsToDel.values()) {
      await ch.delete('Clone: limpeza').catch(() => {});
      await sleep(300);
    }

    const rolesToDel = targetGuild.roles.cache.filter(
      (r) => !r.managed && r.id !== targetGuild.id && r.comparePositionTo(targetGuild.members.me.roles.highest) < 0
    );
    for (const role of rolesToDel.values()) {
      await role.delete('Clone: limpeza').catch(() => {});
      await sleep(200);
    }
  } catch (err) {
    report.errors.push(`Limpeza parcial: ${err.message}`);
  }

  await progressCallback('🎭 Criando cargos...');

  const sortedRoles = [...snapshot.roles].sort((a, b) => a.position - b.position);
  for (const roleData of sortedRoles) {
    try {
      const created = await targetGuild.roles.create({
        name: roleData.name,
        color: roleData.color,
        hoist: roleData.hoist,
        mentionable: roleData.mentionable,
        permissions: BigInt(roleData.permissions),
        reason: 'Server Clone',
      });
      roleMap.set(roleData.name, created.id);
      report.roles.created++;
      await sleep(300);
    } catch (err) {
      report.roles.failed++;
      report.errors.push(`Cargo "${roleData.name}": ${err.message}`);
    }
  }

  await progressCallback('📁 Criando categorias...');

  const categoryMap = new Map();
  const sortedCategories = [...snapshot.categories].sort((a, b) => a.position - b.position);
  for (const catData of sortedCategories) {
    try {
      const created = await targetGuild.channels.create({
        name: catData.name,
        type: ChannelType.GuildCategory,
        reason: 'Server Clone',
      });
      categoryMap.set(catData.name, created.id);
      report.categories.created++;
      await sleep(400);
    } catch (err) {
      report.categories.failed++;
      report.errors.push(`Categoria "${catData.name}": ${err.message}`);
    }
  }

  await progressCallback('💬 Criando canais...');

  const sortedChannels = [...snapshot.channels].sort((a, b) => a.position - b.position);
  for (const chData of sortedChannels) {
    try {
      const options = {
        name: chData.name,
        type: chData.type,
        topic: chData.topic,
        nsfw: chData.nsfw,
        rateLimitPerUser: chData.rateLimitPerUser,
        reason: 'Server Clone',
      };

      if (chData.parentName && categoryMap.has(chData.parentName)) {
        options.parent = categoryMap.get(chData.parentName);
      }

      if (chData.type === ChannelType.GuildVoice) {
        options.userLimit = chData.userLimit;
        options.bitrate = chData.bitrate || 64000;
      }

      await targetGuild.channels.create(options);
      report.channels.created++;
      await sleep(500);
    } catch (err) {
      report.channels.failed++;
      report.errors.push(`Canal "${chData.name}": ${err.message}`);
    }
  }

  await progressCallback('😀 Copiando emojis...');

  for (const emojiData of snapshot.emojis.slice(0, 50)) {
    try {
      await targetGuild.emojis.create({
        attachment: emojiData.url,
        name: emojiData.name,
        reason: 'Server Clone',
      });
      report.emojis.created++;
      await sleep(500);
    } catch {
      report.emojis.failed++;
    }
  }

  try {
    await targetGuild.edit({
      name: snapshot.name,
      description: snapshot.description,
      verificationLevel: snapshot.verificationLevel,
      explicitContentFilter: snapshot.explicitContentFilter,
      defaultMessageNotifications: snapshot.defaultMessageNotifications,
      reason: 'Server Clone',
    });
  } catch (err) {
    report.errors.push(`Config do servidor: ${err.message}`);
  }

  return report;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = { resolveInvite, snapshotGuild, applySnapshot };
