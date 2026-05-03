const { ChannelType } = require('discord.js');
const logger = require('../utils/logger');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function resolveInvite(client, code) {
  try {
    return await client.fetchInvite(code);
  } catch {
    return null;
  }
}

async function snapshotGuild(guild) {
  const snapshot = {
    name: guild.name,
    description: guild.description || null,
    icon: guild.iconURL({ extension: 'png', size: 4096 }) || null,
    banner: guild.bannerURL({ extension: 'png', size: 4096 }) || null,
    splash: guild.splashURL({ extension: 'png', size: 4096 }) || null,
    verificationLevel: guild.verificationLevel,
    explicitContentFilter: guild.explicitContentFilter,
    defaultMessageNotifications: guild.defaultMessageNotifications,
    afkTimeout: guild.afkTimeout,
    preferredLocale: guild.preferredLocale,
    roles: [],
    categories: [],
    channels: [],
    emojis: [],
    stickers: [],
  };

  // ── ROLES ─────────────────────────────────────────────────────────────────
  await guild.roles.fetch();
  const roles = guild.roles.cache
    .filter((r) => !r.managed && r.id !== guild.id)
    .sort((a, b) => a.position - b.position);

  snapshot.roles = roles.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    hoist: r.hoist,
    mentionable: r.mentionable,
    permissions: r.permissions.bitfield.toString(),
    position: r.position,
  }));

  // ── CHANNELS & CATEGORIES ─────────────────────────────────────────────────
  await guild.channels.fetch();

  const serializeOverwrites = (channel) =>
    channel.permissionOverwrites?.cache?.map((o) => ({
      id: o.id,
      type: o.type,
      allow: o.allow.bitfield.toString(),
      deny: o.deny.bitfield.toString(),
    })) || [];

  const categories = guild.channels.cache
    .filter((c) => c.type === ChannelType.GuildCategory)
    .sort((a, b) => a.position - b.position);

  snapshot.categories = categories.map((c) => ({
    id: c.id,
    name: c.name,
    position: c.position,
    permissionOverwrites: serializeOverwrites(c),
  }));

  const supportedTypes = [
    ChannelType.GuildText,
    ChannelType.GuildVoice,
    ChannelType.GuildAnnouncement,
    ChannelType.GuildStageVoice,
    ChannelType.GuildForum,
  ];

  const channels = guild.channels.cache
    .filter((c) => supportedTypes.includes(c.type))
    .sort((a, b) => a.position - b.position);

  snapshot.channels = channels.map((c) => ({
    name: c.name,
    type: c.type,
    position: c.position,
    topic: c.topic || null,
    nsfw: c.nsfw || false,
    rateLimitPerUser: c.rateLimitPerUser || 0,
    userLimit: c.userLimit || 0,
    bitrate: c.bitrate || null,
    parentId: c.parentId || null,
    parentName: c.parent?.name || null,
    permissionOverwrites: serializeOverwrites(c),
    defaultAutoArchiveDuration: c.defaultAutoArchiveDuration || null,
  }));

  // ── EMOJIS ────────────────────────────────────────────────────────────────
  try {
    await guild.emojis.fetch();
    snapshot.emojis = guild.emojis.cache.map((e) => ({
      name: e.name,
      url: e.imageURL({ extension: e.animated ? 'gif' : 'png', size: 128 }),
      animated: e.animated,
    }));
  } catch {
    snapshot.emojis = [];
  }

  // ── STICKERS ──────────────────────────────────────────────────────────────
  try {
    await guild.stickers.fetch();
    snapshot.stickers = guild.stickers.cache.map((s) => ({
      name: s.name,
      description: s.description || '',
      url: s.url,
      tags: s.tags || '',
    }));
  } catch {
    snapshot.stickers = [];
  }

  logger.info(
    `Snapshot de "${guild.name}": ${snapshot.roles.length} cargos, ` +
    `${snapshot.categories.length} cats, ${snapshot.channels.length} canais, ` +
    `${snapshot.emojis.length} emojis, ${snapshot.stickers.length} stickers`
  );

  return snapshot;
}

async function applySnapshot(targetGuild, snapshot, progress) {
  const report = {
    roles: { created: 0, failed: 0 },
    categories: { created: 0, failed: 0 },
    channels: { created: 0, failed: 0 },
    emojis: { created: 0, failed: 0 },
    stickers: { created: 0, failed: 0 },
    errors: [],
  };

  // Maps: sourceId → newId  (for roles and categories)
  const roleMap = new Map();    // sourceRoleId → newRoleId
  const categoryMap = new Map(); // sourceCategoryId / sourceCategoryName → newCategoryId

  // ── 1. CLEAN TARGET ───────────────────────────────────────────────────────
  await progress('🗑️ Limpando canais existentes...');
  const channelsToDel = targetGuild.channels.cache.filter((c) => c.deletable);
  for (const ch of channelsToDel.values()) {
    await ch.delete('Clone: limpeza').catch(() => {});
    await sleep(250);
  }

  await progress('🗑️ Limpando cargos existentes...');
  const myHighest = targetGuild.members.me.roles.highest;
  const rolesToDel = targetGuild.roles.cache.filter(
    (r) => !r.managed && r.id !== targetGuild.id && r.comparePositionTo(myHighest) < 0
  );
  for (const role of rolesToDel.values()) {
    await role.delete('Clone: limpeza').catch(() => {});
    await sleep(200);
  }

  // ── 2. ROLES ──────────────────────────────────────────────────────────────
  await progress(`🎭 Criando ${snapshot.roles.length} cargos...`);

  const sortedRoles = [...snapshot.roles].sort((a, b) => a.position - b.position);
  for (const r of sortedRoles) {
    try {
      const created = await targetGuild.roles.create({
        name: r.name,
        color: r.color,
        hoist: r.hoist,
        mentionable: r.mentionable,
        permissions: BigInt(r.permissions),
        reason: 'Server Clone',
      });
      roleMap.set(r.id, created.id);
      roleMap.set(r.name, created.id); // fallback by name
      report.roles.created++;
      await sleep(300);
    } catch (err) {
      report.roles.failed++;
      report.errors.push(`Cargo "${r.name}": ${err.message}`);
    }
  }

  // ── 3. CATEGORIES ─────────────────────────────────────────────────────────
  await progress(`📁 Criando ${snapshot.categories.length} categorias...`);

  for (const cat of snapshot.categories) {
    try {
      const overwrites = buildOverwrites(cat.permissionOverwrites, roleMap, targetGuild);
      const created = await targetGuild.channels.create({
        name: cat.name,
        type: ChannelType.GuildCategory,
        permissionOverwrites: overwrites,
        reason: 'Server Clone',
      });
      categoryMap.set(cat.id, created.id);
      categoryMap.set(cat.name, created.id);
      report.categories.created++;
      await sleep(400);
    } catch (err) {
      report.categories.failed++;
      report.errors.push(`Categoria "${cat.name}": ${err.message}`);
    }
  }

  // ── 4. CHANNELS ───────────────────────────────────────────────────────────
  await progress(`💬 Criando ${snapshot.channels.length} canais...`);

  const sortedChannels = [...snapshot.channels].sort((a, b) => a.position - b.position);
  for (const ch of sortedChannels) {
    try {
      const overwrites = buildOverwrites(ch.permissionOverwrites, roleMap, targetGuild);

      const options = {
        name: ch.name,
        type: ch.type,
        nsfw: ch.nsfw,
        reason: 'Server Clone',
        permissionOverwrites: overwrites,
      };

      // Set parent category
      const parentId = ch.parentId && categoryMap.get(ch.parentId)
        ? categoryMap.get(ch.parentId)
        : ch.parentName && categoryMap.get(ch.parentName)
          ? categoryMap.get(ch.parentName)
          : null;
      if (parentId) options.parent = parentId;

      // Type-specific options
      if (ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildAnnouncement) {
        options.topic = ch.topic;
        options.rateLimitPerUser = ch.rateLimitPerUser;
        if (ch.defaultAutoArchiveDuration) {
          options.defaultAutoArchiveDuration = ch.defaultAutoArchiveDuration;
        }
      }

      if (ch.type === ChannelType.GuildVoice || ch.type === ChannelType.GuildStageVoice) {
        options.userLimit = ch.userLimit;
        options.bitrate = ch.bitrate ? Math.min(ch.bitrate, 96000) : 64000;
      }

      if (ch.type === ChannelType.GuildForum) {
        options.topic = ch.topic;
        options.rateLimitPerUser = ch.rateLimitPerUser;
      }

      await targetGuild.channels.create(options);
      report.channels.created++;
      await sleep(450);
    } catch (err) {
      report.channels.failed++;
      report.errors.push(`Canal "${ch.name}": ${err.message}`);
    }
  }

  // ── 5. EMOJIS ─────────────────────────────────────────────────────────────
  await progress(`😀 Copiando ${Math.min(snapshot.emojis.length, 50)} emojis...`);

  for (const e of snapshot.emojis.slice(0, 50)) {
    try {
      await targetGuild.emojis.create({ attachment: e.url, name: e.name, reason: 'Server Clone' });
      report.emojis.created++;
      await sleep(500);
    } catch {
      report.emojis.failed++;
    }
  }

  // ── 6. STICKERS ───────────────────────────────────────────────────────────
  if (snapshot.stickers?.length) {
    await progress(`🎟️ Copiando ${Math.min(snapshot.stickers.length, 5)} stickers...`);
    for (const s of snapshot.stickers.slice(0, 5)) {
      try {
        await targetGuild.stickers.create({
          file: s.url,
          name: s.name,
          tags: s.tags || 'clone',
          description: s.description || '',
          reason: 'Server Clone',
        });
        report.stickers.created++;
        await sleep(700);
      } catch {
        report.stickers.failed++;
      }
    }
  }

  // ── 7. SERVER SETTINGS ────────────────────────────────────────────────────
  await progress('⚙️ Aplicando configurações do servidor...');
  try {
    const editOptions = {
      name: snapshot.name,
      verificationLevel: snapshot.verificationLevel,
      explicitContentFilter: snapshot.explicitContentFilter,
      defaultMessageNotifications: snapshot.defaultMessageNotifications,
      preferredLocale: snapshot.preferredLocale,
      reason: 'Server Clone',
    };
    if (snapshot.description) editOptions.description = snapshot.description;
    if (snapshot.afkTimeout) editOptions.afkTimeout = snapshot.afkTimeout;
    if (snapshot.icon) editOptions.icon = snapshot.icon;
    if (snapshot.banner) editOptions.banner = snapshot.banner;
    await targetGuild.edit(editOptions);
  } catch (err) {
    report.errors.push(`Config do servidor: ${err.message}`);
  }

  return report;
}

/**
 * Translates source permission overwrites to use new role IDs in target guild.
 * Overwrites of type 0 (role) are remapped; type 1 (member) are kept as-is.
 */
function buildOverwrites(rawOverwrites, roleMap, targetGuild) {
  if (!rawOverwrites?.length) return [];

  const overwrites = [];
  for (const o of rawOverwrites) {
    if (o.type === 0) {
      // Role overwrite — remap ID
      const newId = roleMap.get(o.id) || (targetGuild.id === o.id ? targetGuild.id : null);
      if (!newId) continue;
      overwrites.push({ id: newId, type: 0, allow: BigInt(o.allow), deny: BigInt(o.deny) });
    } else {
      // Member overwrite — keep as-is (best effort)
      overwrites.push({ id: o.id, type: 1, allow: BigInt(o.allow), deny: BigInt(o.deny) });
    }
  }
  return overwrites;
}

module.exports = { resolveInvite, snapshotGuild, applySnapshot };
